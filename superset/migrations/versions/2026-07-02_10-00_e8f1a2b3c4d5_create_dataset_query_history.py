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
"""create dataset_query_history table

Revision ID: e8f1a2b3c4d5
Revises: d9e2b5f1c7a3
Create Date: 2026-07-02 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "e8f1a2b3c4d5"
down_revision = "d9e2b5f1c7a3"


def upgrade():
    op.create_table(
        "dataset_query_history",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("changed_on", sa.DateTime(), nullable=False),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["dataset_id"], ["tables.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
    )
    op.create_index("ix_dataset_query_history_dataset_id", "dataset_query_history", ["dataset_id"])


def downgrade():
    op.drop_index("ix_dataset_query_history_dataset_id", table_name="dataset_query_history")
    op.drop_table("dataset_query_history")
