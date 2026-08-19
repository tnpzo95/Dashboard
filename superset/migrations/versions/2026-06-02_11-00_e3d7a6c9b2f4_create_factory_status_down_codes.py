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
"""create_factory_status_down_codes

Revision ID: e3d7a6c9b2f4
Revises: b2c5d8e4f9a1
Create Date: 2026-06-02 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision = "e3d7a6c9b2f4"
down_revision = "b2c5d8e4f9a1"

DOWN_CODE_ROWS = (
    ("D1101", "Breakdown(Manual)"),
    ("D2101", "Regular PM"),
    ("D2201", "Check Equipment"),
    ("D2202", "Check Quality"),
    ("D3101", "Shut Down"),
    ("D3102", "Development Run"),
    ("D3103", "CM(Corrective Maintenance)"),
    ("D4101", "Model change"),
    ("D4102", "ChangeSameModel"),
    ("D5101", "Change Material"),
    ("D5102", "Down Material"),
    ("D5103", "Delay in Previous Process"),
)


def upgrade():
    create_table(
        "factory_status_down_codes",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("down_code", sa.String(length=250), nullable=False),
        sa.Column("down_desc", sa.String(length=1000), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint("down_code"),
    )
    bind = op.get_bind()
    for sort_order, (down_code, down_desc) in enumerate(DOWN_CODE_ROWS):
        bind.execute(
            sa.text(
                """
                INSERT INTO factory_status_down_codes (
                    created_on, changed_on, down_code, down_desc, sort_order
                ) VALUES (
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                    :down_code, :down_desc, :sort_order
                )
                """
            ),
            {
                "down_code": down_code,
                "down_desc": down_desc,
                "sort_order": sort_order,
            },
        )


def downgrade():
    drop_table("factory_status_down_codes")
