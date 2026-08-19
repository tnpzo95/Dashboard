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

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.ext.declarative import declared_attr

from superset import db
from superset.models.helpers import UUIDMixin


class FactoryStatusAuditMixin:
    """Nullable audit columns without FAB user relationships."""

    created_on = Column(DateTime, default=datetime.now, nullable=True)
    changed_on = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        nullable=True,
    )

    @declared_attr
    def created_by_fk(cls) -> Column:  # pylint: disable=arguments-renamed
        return Column(Integer, ForeignKey("ab_user.id"), nullable=True)

    @declared_attr
    def changed_by_fk(cls) -> Column:  # pylint: disable=arguments-renamed
        return Column(Integer, ForeignKey("ab_user.id"), nullable=True)


class FactoryStatusLayout(UUIDMixin, FactoryStatusAuditMixin, db.Model):
    """Factory status page layout persisted in Superset metadata."""

    __tablename__ = "factory_status_layouts"

    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True, nullable=False)
    width = Column(Float, nullable=False, default=1840)
    height = Column(Float, nullable=False, default=760)


class FactoryStatusNode(UUIDMixin, FactoryStatusAuditMixin, db.Model):
    """Factory status device node persisted as queryable columns."""

    __tablename__ = "factory_status_nodes"

    __table_args__ = (
        UniqueConstraint("layout_id", "node_id"),
    )

    id = Column(Integer, primary_key=True)

    layout_id = Column(
        Integer,
        ForeignKey("factory_status_layouts.id"),
        nullable=False,
    )

    node_id = Column(String(80), nullable=False)
    device_id = Column(String(250), nullable=True)
    device_code = Column(String(250), nullable=True)
    label = Column(String(120), nullable=True)
    type = Column(String(32), nullable=False)

    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)

    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)

    status = Column(String(32), nullable=False)
    mode = Column(String(32), nullable=False)

    mode_position = Column(
        String(16),
        nullable=False,
        default="top",
    )

    mode_width_percent = Column(
        Float,
        nullable=False,
        default=100,
    )

    sort_order = Column(
        Integer,
        nullable=False,
        default=0,
    )

    res_id = Column(String(250), nullable=True)
    status_text = Column(String(250), nullable=True)
    recipe = Column(String(500), nullable=True)

    down_code = Column(String(250), nullable=True)
    down_desc = Column(String(1000), nullable=True)

    alarm_id = Column(String(250), nullable=True)
    alarm_desc = Column(String(1000), nullable=True)

    down_date = Column(String(250), nullable=True)

    daily_output_qty = Column(Integer, nullable=True)
    daily_ng_qty = Column(Integer, nullable=True)
    delay_time = Column(Float, nullable=True)


class FactoryStatusAlarm(UUIDMixin, FactoryStatusAuditMixin, db.Model):
    """Factory status alarm summary persisted as queryable columns."""

    __tablename__ = "factory_status_alarms"

    __table_args__ = (
        UniqueConstraint("layout_id", "group_name", "eqm", "alarm_code"),
    )

    id = Column(Integer, primary_key=True)

    layout_id = Column(
        Integer,
        ForeignKey("factory_status_layouts.id"),
        nullable=False,
    )
    device_id = Column(String(250), nullable=True)
    group_name = Column(String(80), nullable=False)
    eqm = Column(String(250), nullable=False)
    alarm_code = Column(String(250), nullable=False)
    alarm_count = Column(Integer, nullable=False, default=0)
    alarm_desc = Column(String(1000), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)


class FactoryStatusDownCode(UUIDMixin, FactoryStatusAuditMixin, db.Model):
    """Factory status down-code description mapping."""

    __tablename__ = "factory_status_down_codes"

    id = Column(Integer, primary_key=True)
    down_code = Column(String(250), unique=True, nullable=False)
    down_desc = Column(String(1000), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
