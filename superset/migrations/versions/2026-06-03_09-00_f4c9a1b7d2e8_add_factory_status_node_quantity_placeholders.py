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
"""add_factory_status_node_quantity_placeholders

Revision ID: f4c9a1b7d2e8
Revises: e3d7a6c9b2f4
Create Date: 2026-06-03 09:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f4c9a1b7d2e8"
down_revision = "e3d7a6c9b2f4"


def upgrade():
    op.add_column(
        "factory_status_nodes",
        sa.Column("daily_output_qty", sa.Integer(), nullable=True),
    )
    op.add_column(
        "factory_status_nodes",
        sa.Column("daily_ng_qty", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column("factory_status_nodes", "daily_ng_qty")
    op.drop_column("factory_status_nodes", "daily_output_qty")
