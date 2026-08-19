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
"""add_factory_status_device_id

Revision ID: b2c5d8e4f9a1
Revises: a9f1c3e7b6d4
Create Date: 2026-06-02 10:30:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c5d8e4f9a1"
down_revision = "a9f1c3e7b6d4"


def upgrade():
    op.add_column(
        "factory_status_nodes",
        sa.Column("device_id", sa.String(length=250), nullable=True),
    )
    op.add_column(
        "factory_status_alarms",
        sa.Column("device_id", sa.String(length=250), nullable=True),
    )
    op.create_index(
        "idx_factory_status_nodes_layout_device_id",
        "factory_status_nodes",
        ["layout_id", "device_id"],
    )
    op.create_index(
        "idx_factory_status_alarms_layout_device_id",
        "factory_status_alarms",
        ["layout_id", "device_id"],
    )


def downgrade():
    op.drop_index(
        "idx_factory_status_alarms_layout_device_id",
        table_name="factory_status_alarms",
    )
    op.drop_index(
        "idx_factory_status_nodes_layout_device_id",
        table_name="factory_status_nodes",
    )
    op.drop_column("factory_status_alarms", "device_id")
    op.drop_column("factory_status_nodes", "device_id")
