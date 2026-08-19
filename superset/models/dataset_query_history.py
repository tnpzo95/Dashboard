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
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

from superset.utils import core as utils


class DatasetQueryHistory(Model):
    """Stores SQL query snapshots each time a virtual dataset's SQL is modified."""

    __tablename__ = "dataset_query_history"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False, index=True)
    sql = Column(utils.MediumText(), nullable=False)
    changed_on = Column(DateTime, nullable=False)
    changed_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)

    changed_by = relationship(
        "User",
        foreign_keys=[changed_by_fk],
    )

    @staticmethod
    def _now_utc7() -> datetime:
        utc_plus_7 = timezone(timedelta(hours=7))
        return datetime.now(utc_plus_7).replace(tzinfo=None)

    def __repr__(self) -> str:
        return f"DatasetQueryHistory(dataset_id={self.dataset_id}, changed_on={self.changed_on})"
