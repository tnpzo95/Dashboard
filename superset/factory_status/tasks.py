# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Mapping

from celery.utils.log import get_task_logger
from sqlalchemy import text

from superset import db
from superset.extensions import celery_app
from superset.models.core import Database

DEFAULT_LAYOUT_NAME = "default"
ORACLE_PRODUCT_DATABASE_NAME = "Oracle_Product"

logger = get_task_logger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_value(row: Mapping[str, Any], key: str) -> Any:
    for row_key, value in row.items():
        if str(row_key).upper() == key:
            return value
    return None


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _clean_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clean_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Oracle DB connection
# ---------------------------------------------------------------------------

def _get_oracle_product_database() -> Database:
    database = (
        db.session.query(Database)
        .filter(Database.database_name == ORACLE_PRODUCT_DATABASE_NAME)
        .one_or_none()
    )
    if database is None:
        raise RuntimeError(
            f"Superset database connection '{ORACLE_PRODUCT_DATABASE_NAME}' does not exist"
        )
    # Copy to detach from session before rollback
    database_copy = Database(
        database_name=database.database_name,
        sqlalchemy_uri=database.sqlalchemy_uri,
        password=database.password,
        cache_timeout=database.cache_timeout,
        expose_in_sqllab=database.expose_in_sqllab,
        allow_run_async=database.allow_run_async,
        allow_file_upload=database.allow_file_upload,
        allow_ctas=database.allow_ctas,
        allow_cvas=database.allow_cvas,
        allow_dml=database.allow_dml,
        extra=database.extra,
        encrypted_extra=database.encrypted_extra,
        impersonate_user=database.impersonate_user,
        server_cert=database.server_cert,
    )
    database_copy.id = database.id
    db.session.rollback()
    db.session.remove()
    return database_copy


# ---------------------------------------------------------------------------
# Layout helper
# ---------------------------------------------------------------------------

def _get_factory_status_layout(layout_name: str = DEFAULT_LAYOUT_NAME) -> dict[str, Any]:
    layout = db.session.execute(
        text("SELECT id, name FROM factory_status_layouts WHERE name = :name"),
        {"name": layout_name},
    ).mappings().one_or_none()

    if layout is None:
        if layout_name != DEFAULT_LAYOUT_NAME:
            raise RuntimeError(f"Factory status layout '{layout_name}' does not exist")
        from superset.factory_status.api import _get_or_create_layout
        _get_or_create_layout()
        layout = db.session.execute(
            text("SELECT id, name FROM factory_status_layouts WHERE name = :name"),
            {"name": layout_name},
        ).mappings().one_or_none()
        if layout is None:
            raise RuntimeError(f"Factory status layout '{layout_name}' does not exist")

    return dict(layout)


# ---------------------------------------------------------------------------
# Sync: alarm_summary → factory_status_alarms
# ---------------------------------------------------------------------------

def _sync_alarm_summary(
    rows: list[Mapping[str, Any]],
    layout_name: str = DEFAULT_LAYOUT_NAME,
) -> dict[str, int]:
    layout = _get_factory_status_layout(layout_name)
    layout_id = int(layout["id"])

    existing = db.session.execute(
        text(
            """
            SELECT id, device_id, group_name, eqm, model, alarm_code, alarm_count,
                   alarm_desc, sort_order
            FROM factory_status_alarms
            WHERE layout_id = :layout_id
            """
        ),
        {"layout_id": layout_id},
    ).mappings().all()
    existing_by_key = {
        (r["group_name"], r["eqm"], r["alarm_code"]): dict(r) for r in existing
    }

    seen_keys: set[tuple[str, str, str]] = set()
    inserted = updated = skipped = 0

    for row in rows:
        group_name = _clean_string(_row_value(row, "EQP_ID"))
        eqm = _clean_string(_row_value(row, "EQP_NO"))
        alarm_code = _clean_string(_row_value(row, "ARM_ID"))
        model = _clean_string(_row_value(row, "MODEL"))

        if not (group_name and eqm and alarm_code):
            skipped += 1
            logger.warning("Skipping alarm row with missing key: %s", row)
            continue

        key = (group_name, eqm, alarm_code)
        seen_keys.add(key)
        alarm_count = _clean_int(_row_value(row, "ARM_CNT"))
        sort_order = max(_clean_int(_row_value(row, "RN"), default=1) - 1, 0)
        now = datetime.now()

        existing_alarm = existing_by_key.get(key)
        if existing_alarm is None:
            db.session.execute(
                text(
                    """
                    INSERT INTO factory_status_alarms (
                        created_on, changed_on, layout_id, device_id, group_name,
                        eqm, model, alarm_code, alarm_count, alarm_desc, sort_order
                    ) VALUES (
                        :now, :now, :layout_id, :device_id, :group_name,
                        :eqm, :model, :alarm_code, :alarm_count, NULL, :sort_order
                    )
                    """
                ),
                {
                    "now": now, "layout_id": layout_id, "device_id": eqm,
                    "group_name": group_name, "eqm": eqm, "model": model,
                    "alarm_code": alarm_code, "alarm_count": alarm_count,
                    "sort_order": sort_order,
                },
            )
            inserted += 1
        else:
            changed = (
                existing_alarm["device_id"] != eqm
                or existing_alarm["alarm_count"] != alarm_count
                or existing_alarm["sort_order"] != sort_order
                or existing_alarm["alarm_desc"] is not None
                or existing_alarm["model"] != model
            )
            if changed:
                db.session.execute(
                    text(
                        """
                        UPDATE factory_status_alarms
                        SET changed_on = :now, device_id = :device_id,
                            alarm_count = :alarm_count, alarm_desc = NULL,
                            sort_order = :sort_order, model = :model
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": existing_alarm["id"], "now": now,
                        "device_id": eqm, "alarm_count": alarm_count,
                        "sort_order": sort_order, "model": model,
                    },
                )
                updated += 1

    deleted = 0
    for key, alarm in existing_by_key.items():
        if key not in seen_keys:
            db.session.execute(
                text("DELETE FROM factory_status_alarms WHERE id = :id"),
                {"id": alarm["id"]},
            )
            deleted += 1

    if inserted or updated or deleted:
        db.session.execute(
            text(
                "UPDATE factory_status_layouts SET changed_on = :now WHERE id = :id"
            ),
            {"id": layout_id, "now": datetime.now()},
        )

    db.session.commit()
    return {
        "inserted": inserted, "updated": updated,
        "deleted": deleted, "skipped": skipped, "rows": len(rows),
    }


# ---------------------------------------------------------------------------
# Sync: sync_node_status → factory_status_nodes status, mode, recipe
# ---------------------------------------------------------------------------

def _sync_node_status_data(
    rows: list[dict[str, Any]],
    layout_name: str = DEFAULT_LAYOUT_NAME,
) -> dict[str, int]:
    """
    Sync factory status node status, mode, recipe from Oracle_Product.
    Reuses logic from factory_status.api.
    """
    layout = _get_factory_status_layout(layout_name)
    layout_id = int(layout["id"])
    now = datetime.now()

    updated = 0
    skipped = 0

    for row in rows:
        res_id = _clean_string(_row_value(row, "RES_ID")) or _clean_string(
            _row_value(row, "EQP_ID")
        )
        if not res_id:
            skipped += 1
            logger.warning("Skipping status row with missing RES_ID: %s", row)
            continue

        status_raw = _clean_string(_row_value(row, "STATUS")) or "run"
        status = status_raw.lower().replace("_", " ").strip()
        if status in ("run", "idle", "down", "power_off", "disconnection"):
            normalized_status = status
        else:
            normalized_status = "power_off"

        mode_raw = _clean_string(_row_value(row, "MODE_1")) or "offline"
        mode = mode_raw.lower().strip()
        if mode in ("remote", "local", "offline"):
            normalized_mode = mode
        else:
            normalized_mode = "offline"

        recipe = _clean_string(_row_value(row, "RECIPE")) or ""
        status_text = normalized_status.replace("_", " ").upper()

        result = db.session.execute(
            text(
                """
                UPDATE factory_status_nodes
                SET changed_on = :now,
                    status = :status,
                    status_text = :status_text,
                    mode = :mode,
                    recipe = :recipe
                WHERE layout_id = :layout_id
                  AND (
                      device_id = :res_id
                      OR device_code = :res_id
                      OR res_id = :res_id
                  )
                """
            ),
            {
                "now": now,
                "layout_id": layout_id,
                "res_id": res_id,
                "status": normalized_status,
                "status_text": status_text,
                "mode": normalized_mode,
                "recipe": recipe,
            },
        )
        if result.rowcount:
            updated += int(result.rowcount)
        else:
            skipped += 1

    if updated:
        db.session.execute(
            text(
                """
                UPDATE factory_status_layouts
                SET changed_on = :now
                WHERE id = :layout_id
                """
            ),
            {"layout_id": layout_id, "now": now},
        )

    db.session.commit()
    return {
        "rows": len(rows),
        "updated": updated,
        "skipped": skipped,
    }


# ---------------------------------------------------------------------------
# Sync: node_delay_time → factory_status_nodes.delay_time
# Delay_time có giá trị → nhấp nháy, null → không nhấp nháy
# ---------------------------------------------------------------------------

def _sync_node_delay_time(
    rows: list[Mapping[str, Any]],
    layout_name: str = DEFAULT_LAYOUT_NAME,
) -> dict[str, int]:
    layout = _get_factory_status_layout(layout_name)
    layout_id = int(layout["id"])
    now = datetime.now()

    # Reset tất cả về NULL trước — node không có trong kết quả sẽ không nhấp nháy
    cleared = db.session.execute(
        text(
            """
            UPDATE factory_status_nodes
            SET changed_on = :now, delay_time = NULL
            WHERE layout_id = :layout_id AND delay_time IS NOT NULL
            """
        ),
        {"layout_id": layout_id, "now": now},
    )

    updated = skipped = 0
    for row in rows:
        res_id = _clean_string(_row_value(row, "RES_ID"))
        delay_time = _clean_float(_row_value(row, "DELAY_TIME"))
        if res_id is None or delay_time is None:
            skipped += 1
            logger.warning("Skipping delay row with missing value: %s", row)
            continue

        result = db.session.execute(
            text(
                """
                UPDATE factory_status_nodes
                SET changed_on = :now, delay_time = :delay_time
                WHERE layout_id = :layout_id
                  AND (device_id = :res_id OR device_code = :res_id OR res_id = :res_id)
                """
            ),
            {
                "layout_id": layout_id, "now": now,
                "res_id": res_id, "delay_time": delay_time,
            },
        )
        if result.rowcount:
            updated += int(result.rowcount)
        else:
            skipped += 1

    cleared_count = int(cleared.rowcount or 0)
    if cleared_count or updated:
        db.session.execute(
            text(
                "UPDATE factory_status_layouts SET changed_on = :now WHERE id = :id"
            ),
            {"id": layout_id, "now": now},
        )

    db.session.commit()
    return {
        "rows": len(rows), "updated": updated,
        "cleared": cleared_count, "skipped": skipped,
    }


# ---------------------------------------------------------------------------
# Load configs from factory_status_task_configs
# ---------------------------------------------------------------------------

def _load_due_configs() -> list[dict[str, Any]]:
    """Return active configs whose interval has elapsed since last_run_at."""
    now = datetime.now()
    rows = db.session.execute(
        text(
            """
            SELECT id, name, task_type, sql_query, interval_min,
                   layout_name, last_run_at
            FROM factory_status_task_configs
            WHERE is_active = TRUE
              AND task_type <> 'node_worker'
            ORDER BY id
            """
        )
    ).mappings().all()

    due = []
    for row in rows:
        interval_sec = int(row["interval_min"] or 1) * 60
        last_run = row["last_run_at"]
        if last_run is None or (now - last_run).total_seconds() >= interval_sec:
            due.append(dict(row))
    return due


def _mark_config_result(config_id: int, result: dict[str, Any]) -> None:
    db.session.execute(
        text(
            """
            UPDATE factory_status_task_configs
            SET last_run_at = :now, last_run_result = :result
            WHERE id = :id
            """
        ),
        {
            "id": config_id,
            "now": datetime.now(),
            "result": json.dumps(result),
        },
    )
    db.session.commit()


def _execute_config(config: dict[str, Any], database: Database) -> dict[str, Any]:
    task_type = (config.get("task_type") or "").strip().lower()
    layout_name = config.get("layout_name") or DEFAULT_LAYOUT_NAME
    sql_query = config.get("sql_query") or ""

    with database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            result = connection.execute(text(sql_query))
            rows = [dict(r) for r in result.mappings().all()]

    if task_type == "alarm_summary":
        return _sync_alarm_summary(rows, layout_name)
    if task_type == "node_delay_time":
        return _sync_node_delay_time(rows, layout_name)

    raise ValueError(f"Unknown task_type '{task_type}' for config '{config['name']}'")


# ---------------------------------------------------------------------------
# Celery task — chạy mỗi phút, tự kiểm tra config nào đến hạn
# ---------------------------------------------------------------------------

@celery_app.task(name="factory_status.run_task_configs")
def run_task_configs() -> dict[str, Any]:
    """
    Runs every minute via beat schedule.
    Reads factory_status_task_configs, executes any config whose interval has elapsed.
    """
    results: dict[str, Any] = {}
    try:
        configs = _load_due_configs()
        if not configs:
            logger.debug("factory_status: no configs due, skipping")
            return results

        database = _get_oracle_product_database()

        for config in configs:
            name = config["name"]
            try:
                result = _execute_config(config, database)
                _mark_config_result(config["id"], result)
                results[name] = result
                logger.info("factory_status task '%s': %s", name, result)
            except Exception:
                db.session.rollback()
                logger.exception("factory_status task '%s' failed", name)
                results[name] = {"error": True}

        return results
    except Exception:
        db.session.rollback()
        logger.exception("run_task_configs failed")
        raise
    finally:
        db.session.remove()


# ---------------------------------------------------------------------------
# Celery task — đồng bộ trạng thái node mỗi 2 phút
# ---------------------------------------------------------------------------

@celery_app.task(name="factory_status.sync_node_status")
def sync_node_status() -> dict[str, Any]:
    """
    Runs every 2 minutes via beat schedule.
    Syncs node status, mode, and recipe from Oracle_Product MRASRESDEF.
    """
    NODE_STATUS_SYNC_SQL = """
    SELECT
        FACTORY,
        RES_ID AS EQP_ID,
        CASE
            WHEN RES_CTRL_MODE = 'OF' THEN 'power_off'
            WHEN RES_STS_1 = 'RUN' THEN 'run'
            WHEN RES_STS_1 = 'IDLE' THEN 'idle'
            WHEN RES_STS_1 = 'DOWN' THEN 'down'
            WHEN RES_STS_1 = 'PUSH' THEN 'run'
            WHEN RES_STS_1 = 'STOP' THEN 'down'
            ELSE LOWER(RES_STS_1)
        END AS status,
        CASE RES_CTRL_MODE
            WHEN 'OF' THEN 'offline'
            WHEN 'OL' THEN 'local'
            WHEN 'OR' THEN 'remote'
            ELSE LOWER(RES_CTRL_MODE)
        END AS mode_1,
        RES_CMF_2 AS recipe
    FROM MRASRESDEF
    WHERE FACTORY = 'DV01'
    ORDER BY EQP_ID ASC
    """
    try:
        database = _get_oracle_product_database()
        with database.get_sqla_engine() as engine:
            with engine.connect() as connection:
                result = connection.execute(text(NODE_STATUS_SYNC_SQL))
                rows = [dict(r) for r in result.mappings().all()]

        result_data = _sync_node_status_data(rows)
        logger.info("sync_node_status result: %s", result_data)
        return result_data
    except Exception:
        db.session.rollback()
        logger.exception("sync_node_status failed")
        raise
    finally:
        db.session.remove()
