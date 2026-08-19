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
"""normalize_factory_status_nodes

Revision ID: c8b4f2a1d9e3
Revises: f7a9c4d2e6b1
Create Date: 2026-06-01 13:00:00.000000

"""

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "c8b4f2a1d9e3"
down_revision = "f7a9c4d2e6b1"


def _detail_value(details: dict[str, object], keys: list[str], fallback: str = "") -> str:
    for key in keys:
        value = details.get(key)
        if value is not None:
            return str(value)
    return fallback


def _status_text(status: str) -> str:
    return status.replace("_", " ").upper()


def upgrade():
    op.add_column("factory_status_layouts", sa.Column("width", sa.Float(), nullable=True))
    op.add_column("factory_status_layouts", sa.Column("height", sa.Float(), nullable=True))

    create_table(
        "factory_status_nodes",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("layout_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.String(length=80), nullable=False),
        sa.Column("device_code", sa.String(length=250), nullable=True),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("mode_position", sa.String(length=16), nullable=False),
        sa.Column("mode_width_percent", sa.Float(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("res_id", sa.String(length=250), nullable=True),
        sa.Column("status_text", sa.String(length=250), nullable=True),
        sa.Column("recipe", sa.String(length=500), nullable=True),
        sa.Column("down_code", sa.String(length=250), nullable=True),
        sa.Column("down_desc", sa.String(length=1000), nullable=True),
        sa.Column("alarm_id", sa.String(length=250), nullable=True),
        sa.Column("alarm_desc", sa.String(length=1000), nullable=True),
        sa.Column("down_date", sa.String(length=250), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint("layout_id", "node_id"),
    )

    create_fks_for_table(
        "fk_factory_status_nodes_layout_id_factory_status_layouts",
        "factory_status_nodes",
        "factory_status_layouts",
        ["layout_id"],
        ["id"],
    )
    create_fks_for_table(
        "fk_factory_status_nodes_created_by_fk_ab_user",
        "factory_status_nodes",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )
    create_fks_for_table(
        "fk_factory_status_nodes_changed_by_fk_ab_user",
        "factory_status_nodes",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )

    bind = op.get_bind()
    layouts = bind.execute(
        sa.text("SELECT id, layout_json FROM factory_status_layouts")
    ).fetchall()
    for layout in layouts:
        payload = json.loads(layout.layout_json)
        bind.execute(
            sa.text(
                """
                UPDATE factory_status_layouts
                SET width = :width, height = :height
                WHERE id = :id
                """
            ),
            {
                "id": layout.id,
                "width": payload.get("width", 1840),
                "height": payload.get("height", 760),
            },
        )

        for sort_order, node in enumerate(payload.get("nodes", [])):
            details = node.get("details") or {}
            status = node.get("status", "run")
            label = node.get("label", node.get("id", ""))
            bind.execute(
                sa.text(
                    """
                    INSERT INTO factory_status_nodes (
                        layout_id, node_id, device_code, label, type, x, y, width, height,
                        status, mode, mode_position, mode_width_percent, sort_order,
                        res_id, status_text, recipe, down_code, down_desc, alarm_id,
                        alarm_desc, down_date
                    ) VALUES (
                        :layout_id, :node_id, :device_code, :label, :type, :x, :y, :width, :height,
                        :status, :mode, :mode_position, :mode_width_percent, :sort_order,
                        :res_id, :status_text, :recipe, :down_code, :down_desc, :alarm_id,
                        :alarm_desc, :down_date
                    )
                    """
                ),
                {
                    "layout_id": layout.id,
                    "node_id": node.get("id"),
                    "device_code": _detail_value(
                        details,
                        ["DEVICE_CODE", "Device Code", "device_code"],
                        node.get("id", ""),
                    ),
                    "label": label,
                    "type": node.get("type", "equipment"),
                    "x": node.get("x", 0),
                    "y": node.get("y", 0),
                    "width": node.get("width", 120),
                    "height": node.get("height", 54),
                    "status": status,
                    "mode": node.get("mode", "remote"),
                    "mode_position": node.get("modePosition", "top"),
                    "mode_width_percent": node.get("modeWidthPercent", 100),
                    "sort_order": sort_order,
                    "res_id": _detail_value(details, ["RES_ID", "EQM"], label),
                    "status_text": _detail_value(
                        details,
                        ["STATUS", "Status", "status"],
                        _status_text(status),
                    ),
                    "recipe": _detail_value(details, ["RECIPE", "Recipe", "recipe"]),
                    "down_code": _detail_value(
                        details,
                        ["DOWN_CODE", "Down Code", "Alarm Code", "alarm_code"],
                    ),
                    "down_desc": _detail_value(
                        details,
                        ["DOWN_DESC", "Down Desc", "down_desc"],
                    ),
                    "alarm_id": _detail_value(
                        details,
                        ["ALARM_ID", "Alarm ID", "alarm_id"],
                    ),
                    "alarm_desc": _detail_value(
                        details,
                        ["ALARM_DESC", "Alarm Desc", "alarm_desc"],
                    ),
                    "down_date": _detail_value(
                        details,
                        ["DOWN_DATE", "Down Date", "down_date"],
                    ),
                },
            )

    bind.execute(
        sa.text(
            """
            UPDATE factory_status_layouts
            SET width = COALESCE(width, 1840), height = COALESCE(height, 760)
            """
        )
    )
    op.alter_column("factory_status_layouts", "width", nullable=False)
    op.alter_column("factory_status_layouts", "height", nullable=False)
    op.drop_column("factory_status_layouts", "layout_json")


def downgrade():
    op.add_column(
        "factory_status_layouts",
        sa.Column(
            "layout_json",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
    )
    bind = op.get_bind()
    layouts = bind.execute(
        sa.text("SELECT id, name, width, height FROM factory_status_layouts")
    ).fetchall()
    for layout in layouts:
        nodes = bind.execute(
            sa.text(
                """
                SELECT *
                FROM factory_status_nodes
                WHERE layout_id = :layout_id
                ORDER BY sort_order
                """
            ),
            {"layout_id": layout.id},
        ).fetchall()
        payload = {
            "name": layout.name,
            "width": layout.width,
            "height": layout.height,
            "nodes": [
                {
                    "id": node.node_id,
                    "deviceCode": node.device_code,
                    "label": node.label,
                    "type": node.type,
                    "x": node.x,
                    "y": node.y,
                    "width": node.width,
                    "height": node.height,
                    "status": node.status,
                    "mode": node.mode,
                    "modePosition": node.mode_position,
                    "modeWidthPercent": node.mode_width_percent,
                    "details": {
                        "RES_ID": node.res_id,
                        "STATUS": node.status_text,
                        "RECIPE": node.recipe,
                        "DOWN_CODE": node.down_code,
                        "DOWN_DESC": node.down_desc,
                        "ALARM_ID": node.alarm_id,
                        "ALARM_DESC": node.alarm_desc,
                        "DOWN_DATE": node.down_date,
                    },
                }
                for node in nodes
            ],
        }
        bind.execute(
            sa.text(
                """
                UPDATE factory_status_layouts
                SET layout_json = :layout_json
                WHERE id = :id
                """
            ),
            {"id": layout.id, "layout_json": json.dumps(payload)},
        )

    op.alter_column("factory_status_layouts", "layout_json", nullable=False)
    drop_table("factory_status_nodes")
    op.drop_column("factory_status_layouts", "width")
    op.drop_column("factory_status_layouts", "height")
