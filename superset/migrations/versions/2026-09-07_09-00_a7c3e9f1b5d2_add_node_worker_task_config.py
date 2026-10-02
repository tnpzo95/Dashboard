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
"""add_node_worker_task_config

Seed an editable SQL row for the Factory Status node popup "WORKER" line.
Unlike the other task configs this is NOT run by the scheduler -- it is an
on-demand query executed per node click and MUST keep the ``:device_id``
bind parameter (the node RES_ID).

Revision ID: a7c3e9f1b5d2
Revises: d5f6a7b8c9e0
Create Date: 2026-09-07 09:00:00.000000

"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a7c3e9f1b5d2"
down_revision = "d5f6a7b8c9e0"

TABLE_NAME = "factory_status_task_configs"
CONFIG_NAME = "node_worker_popup"
TASK_TYPE = "node_worker"

NODE_WORKER_SQL = """SELECT c.WORKER_ID, c.WORKER_DESC, c.CMF_1 AS WORKER_LEVEL
FROM CWIPWRKDEF c
WHERE c.WORKER_ID IN (
    SELECT USER_NAME
    FROM (
        SELECT USER_NAME, LOG_TIME,
            ROW_NUMBER() OVER (
                PARTITION BY A.RES_ID ORDER BY A.LOG_TIME DESC
            ) AS RN
        FROM CLOGMESDAT A
        WHERE A.LOG_TIME > TO_CHAR(SYSDATE - 1, 'YYYYMMDDHH24MISS')
            AND A.RES_ID = :device_id
    )
    WHERE RN = 1
)"""

DESCRIPTION = (
    "Query lay worker dang lam viec tai node, hien o dong WORKER trong popup "
    "man hinh factory_status. Chay khi bam vao node (khong theo lich). "
    "Bat buoc giu bind param :device_id (RES_ID cua node). "
    "Cot tra ve: WORKER_ID, WORKER_DESC, WORKER_LEVEL. "
    "Tat Active = dung lai query mac dinh trong source."
)


def upgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(f"SELECT 1 FROM {TABLE_NAME} WHERE name = :name"),
        {"name": CONFIG_NAME},
    ).first()
    if exists:
        return

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
                "name": CONFIG_NAME,
                "description": DESCRIPTION,
                "task_type": TASK_TYPE,
                "sql_query": NODE_WORKER_SQL,
                "interval_min": 1,
                "layout_name": "default",
                "is_active": True,
                "created_on": now,
                "changed_on": now,
            }
        ],
    )


def downgrade() -> None:
    op.get_bind().execute(
        sa.text(f"DELETE FROM {TABLE_NAME} WHERE name = :name"),
        {"name": CONFIG_NAME},
    )
