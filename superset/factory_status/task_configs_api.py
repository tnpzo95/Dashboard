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

import logging
from datetime import datetime
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from sqlalchemy import text

from superset.extensions import db
from superset.views.base_api import BaseSupersetApi

logger = logging.getLogger(__name__)


def _serialize(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


class FactoryStatusTaskConfigsApi(BaseSupersetApi):
    """CRUD API for factory_status_task_configs.
    Only sql_query, interval_min and is_active are editable — name and task_type
    are read-only identifiers set at creation time.
    """

    resource_name = "factory_status/task_configs"
    allow_browser_login = True

    @expose("/", methods=("GET",))
    @protect()
    @safe
    def list(self) -> Response:
        """Return all task configs.
        ---
        get:
          summary: List factory status task configs
          responses:
            200:
              description: List of task configs
        """
        try:
            rows = db.session.execute(
                text(
                    """
                    SELECT id, name, description, task_type, sql_query,
                           interval_min, layout_name, is_active,
                           last_run_at, last_run_result
                    FROM factory_status_task_configs
                    ORDER BY id
                    """
                )
            ).mappings().all()
            return self.response(
                200,
                result=[{k: _serialize(v) for k, v in row.items()} for row in rows],
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Error listing task configs")
            return self.response_500(message=str(ex))

    @expose("/<int:config_id>", methods=("PUT",))
    @protect()
    @safe
    def update(self, config_id: int) -> Response:
        """Update sql_query, interval_min, is_active for a task config.
        name and task_type are NOT editable.
        ---
        put:
          summary: Update task config (sql_query / interval_min / is_active only)
          parameters:
            - in: path
              name: config_id
              schema:
                type: integer
          responses:
            200:
              description: Updated config
            404:
              description: Config not found
            400:
              description: Bad request
        """
        body = request.get_json(force=True, silent=True) or {}

        # Validate interval_min
        interval_min = body.get("interval_min")
        if interval_min is not None:
            try:
                interval_min = int(interval_min)
                if interval_min < 1:
                    raise ValueError
            except (TypeError, ValueError):
                return self.response_400(message="interval_min must be a positive integer")

        sql_query = body.get("sql_query")
        if sql_query is not None and not str(sql_query).strip():
            return self.response_400(message="sql_query must not be empty")

        is_active = body.get("is_active")

        try:
            existing = db.session.execute(
                text(
                    "SELECT id FROM factory_status_task_configs WHERE id = :id"
                ),
                {"id": config_id},
            ).mappings().one_or_none()

            if existing is None:
                return self.response_404()

            # Build SET clause from only provided fields
            updates: dict[str, Any] = {"id": config_id, "now": datetime.now()}
            set_parts = ["changed_on = :now"]

            if sql_query is not None:
                updates["sql_query"] = str(sql_query).strip()
                set_parts.append("sql_query = :sql_query")
            if interval_min is not None:
                updates["interval_min"] = interval_min
                set_parts.append("interval_min = :interval_min")
            if is_active is not None:
                updates["is_active"] = bool(is_active)
                set_parts.append("is_active = :is_active")

            if len(set_parts) == 1:
                return self.response_400(
                    message="Provide at least one of: sql_query, interval_min, is_active"
                )

            db.session.execute(
                text(
                    f"UPDATE factory_status_task_configs"  # noqa: S608
                    f" SET {', '.join(set_parts)}"
                    f" WHERE id = :id"
                ),
                updates,
            )
            db.session.commit()

            row = db.session.execute(
                text(
                    """
                    SELECT id, name, description, task_type, sql_query,
                           interval_min, layout_name, is_active,
                           last_run_at, last_run_result
                    FROM factory_status_task_configs
                    WHERE id = :id
                    """
                ),
                {"id": config_id},
            ).mappings().one()

            return self.response(
                200, result={k: _serialize(v) for k, v in row.items()}
            )
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            logger.exception("Error updating task config id=%s", config_id)
            return self.response_500(message=str(ex))
