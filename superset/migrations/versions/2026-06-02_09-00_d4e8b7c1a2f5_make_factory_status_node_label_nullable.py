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
"""make_factory_status_node_label_nullable

Revision ID: d4e8b7c1a2f5
Revises: c8b4f2a1d9e3
Create Date: 2026-06-02 09:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4e8b7c1a2f5"
down_revision = "c8b4f2a1d9e3"


def upgrade():
    op.alter_column(
        "factory_status_nodes",
        "label",
        existing_type=sa.String(length=120),
        nullable=True,
    )


def downgrade():
    op.execute(
        """
        UPDATE factory_status_nodes
        SET label = node_id
        WHERE label IS NULL
        """
    )
    op.alter_column(
        "factory_status_nodes",
        "label",
        existing_type=sa.String(length=120),
        nullable=False,
    )
