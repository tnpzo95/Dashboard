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
"""create_factory_status_task_configs

Revision ID: c3f1a8b2d7e4
Revises: b7d3c6a2f4e9
Create Date: 2026-06-17 09:00:00.000000

"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c3f1a8b2d7e4"
down_revision = "b7d3c6a2f4e9"

TABLE_NAME = "factory_status_task_configs"

# Seed data — 2 tasks hiện tại chuyển vào đây
SEED_ROWS = [
    {
        "name": "sync_alarm_summary",
        "description": "Sync alarm summary từ Oracle vào factory_status_alarms",
        "task_type": "alarm_summary",
        "interval_min": 2,
        "layout_name": "default",
        "is_active": True,
        "sql_query": """SELECT *
  FROM (
      SELECT A.*,
             ROW_NUMBER() OVER(
                 PARTITION BY EQP_ID
                 ORDER BY ARM_CNT DESC, EQP_NO ASC, ARM_ID ASC
             ) AS RN
      FROM (
           SELECT
               B.RES_GRP_1 as EQP_ID,
               A.RES_ID    as EQP_NO,
               A.ALARM_ID  AS ARM_ID,
               COUNT(*)    AS ARM_CNT
           FROM MALMMSGHIS A, MRASRESDEF B
           WHERE A.FACTORY = 'DV01'
             AND A.FACTORY = B.FACTORY
             AND A.RES_ID  = B.RES_ID
             AND A.TRAN_TIME >= FN_GET_WORK_DATE(
                 'DV01',
                 TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS')
             ) || '08'
           GROUP BY B.RES_GRP_1, A.RES_ID, A.ALARM_ID
      ) A
  ) A
 WHERE RN <= 3""",
    },
    {
        "name": "sync_node_delay_time",
        "description": "Sync delay time từ Oracle vào factory_status_nodes.delay_time",
        "task_type": "node_delay_time",
        "interval_min": 1,
        "layout_name": "default",
        "is_active": True,
        "sql_query": """SELECT
    RES_ID,
    COUNT(*) DELAY_OVER_10S_TIME,
    ROUND(AVG(TO_NUMBER(TRIM(RESV_FIELD_5)) - TO_NUMBER(TRIM(RESV_FIELD_2))), 2) DELAY_TIME
FROM CLOGMESDAT C
WHERE LOG_TIME >= TO_CHAR(SYSDATE - 4/24, 'YYYYMMDDHH24MISS')
  AND c.RESV_FIELD_6 LIKE '%EIS_PP_AP0%'
  AND REGEXP_LIKE(TRIM(RESV_FIELD_2), '^[0-9]*\\.?[0-9]+$')
  AND REGEXP_LIKE(TRIM(RESV_FIELD_5), '^[0-9]*\\.?[0-9]+$')
  AND TO_NUMBER(TRIM(RESV_FIELD_5)) - TO_NUMBER(TRIM(RESV_FIELD_2)) > 5
GROUP BY RES_ID
ORDER BY RES_ID""",
    },
]


def upgrade() -> None:
    op.create_table(
        TABLE_NAME,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(256), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        # alarm_summary | node_delay_time
        sa.Column("task_type", sa.String(64), nullable=False),
        sa.Column("sql_query", sa.Text, nullable=False),
        sa.Column("interval_min", sa.Integer, nullable=False, server_default="1"),
        sa.Column("layout_name", sa.String(256), nullable=False, server_default="default"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_run_at", sa.DateTime, nullable=True),
        sa.Column("last_run_result", sa.Text, nullable=True),
        sa.Column("created_on", sa.DateTime, nullable=True),
        sa.Column("changed_on", sa.DateTime, nullable=True),
    )

    op.create_index(
        f"ix_{TABLE_NAME}_is_active",
        TABLE_NAME,
        ["is_active"],
    )

    # Seed initial rows
    table = sa.table(
        TABLE_NAME,
        sa.column("name"),
        sa.column("description"),
        sa.column("task_type"),
        sa.column("sql_query"),
        sa.column("interval_min"),
        sa.column("layout_name"),
        sa.column("is_active"),
        sa.column("created_on"),
        sa.column("changed_on"),
    )
    now = datetime.utcnow()
    op.bulk_insert(
        table,
        [
            {
                "name": row["name"],
                "description": row["description"],
                "task_type": row["task_type"],
                "sql_query": row["sql_query"],
                "interval_min": row["interval_min"],
                "layout_name": row["layout_name"],
                "is_active": row["is_active"],
                "created_on": now,
                "changed_on": now,
            }
            for row in SEED_ROWS
        ],
    )


def downgrade() -> None:
    op.drop_index(f"ix_{TABLE_NAME}_is_active", table_name=TABLE_NAME)
    op.drop_table(TABLE_NAME)
