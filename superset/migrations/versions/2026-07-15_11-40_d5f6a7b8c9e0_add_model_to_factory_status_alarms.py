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
"""add model column to factory_status_alarms

Revision ID: d5f6a7b8c9e0
Revises: f1a2b3c4d5e6
Create Date: 2026-07-15 11:40:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "d5f6a7b8c9e0"
down_revision = "f1a2b3c4d5e6"


def upgrade():
    op.add_column(
        "factory_status_alarms",
        sa.Column("model", sa.String(length=250), nullable=True),
    )


def downgrade():
    op.drop_column("factory_status_alarms", "model")
