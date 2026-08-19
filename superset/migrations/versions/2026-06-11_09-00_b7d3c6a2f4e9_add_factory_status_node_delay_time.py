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
"""add_factory_status_node_delay_time

Revision ID: b7d3c6a2f4e9
Revises: f4c9a1b7d2e8
Create Date: 2026-06-11 09:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "b7d3c6a2f4e9"
down_revision = "f4c9a1b7d2e8"


def upgrade():
    add_columns(
        "factory_status_nodes",
        sa.Column("delay_time", sa.Float(), nullable=True),
    )


def downgrade():
    drop_columns("factory_status_nodes", "delay_time")
