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
"""create_factory_status_cim_controlmode_history

Revision ID: d9e2b5f1c7a3
Revises: c3f1a8b2d7e4
Create Date: 2026-07-01 09:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision = "d9e2b5f1c7a3"
down_revision = "c3f1a8b2d7e4"


def upgrade():
    create_table(
        "factory_status_cim_controlmode_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("res_id", sa.String(length=250), nullable=False),
        sa.Column("cim_controlmode", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    drop_table("factory_status_cim_controlmode_history")
