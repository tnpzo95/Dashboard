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
"""create_factory_status_alarms

Revision ID: a9f1c3e7b6d4
Revises: d4e8b7c1a2f5
Create Date: 2026-06-02 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "a9f1c3e7b6d4"
down_revision = "d4e8b7c1a2f5"


def upgrade():
    create_table(
        "factory_status_alarms",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("layout_id", sa.Integer(), nullable=False),
        sa.Column("group_name", sa.String(length=80), nullable=False),
        sa.Column("eqm", sa.String(length=250), nullable=False),
        sa.Column("alarm_code", sa.String(length=250), nullable=False),
        sa.Column("alarm_count", sa.Integer(), nullable=False),
        sa.Column("alarm_desc", sa.String(length=1000), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint("layout_id", "group_name", "eqm", "alarm_code"),
    )
    create_fks_for_table(
        "fk_factory_status_alarms_layout_id_factory_status_layouts",
        "factory_status_alarms",
        "factory_status_layouts",
        ["layout_id"],
        ["id"],
    )
    create_fks_for_table(
        "fk_factory_status_alarms_created_by_fk_ab_user",
        "factory_status_alarms",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )
    create_fks_for_table(
        "fk_factory_status_alarms_changed_by_fk_ab_user",
        "factory_status_alarms",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )


def downgrade():
    drop_table("factory_status_alarms")
