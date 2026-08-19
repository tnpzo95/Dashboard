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
from marshmallow import EXCLUDE, fields, Schema
from marshmallow.validate import Length, OneOf, Range


class FactoryStatusNodeSchema(Schema):
    id = fields.String(required=True, validate=[Length(min=1, max=80)])
    deviceId = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    deviceCode = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    label = fields.String(
        required=False,
        allow_none=True,
        load_default=None,
        validate=[Length(max=120)],
    )
    type = fields.String(
        required=True,
        validate=[OneOf(["equipment", "area", "label"])],
    )
    x = fields.Float(required=True, validate=[Range(min=0)])
    y = fields.Float(required=True, validate=[Range(min=0)])
    width = fields.Float(required=True, validate=[Range(min=20)])
    height = fields.Float(required=True, validate=[Range(min=20)])
    status = fields.String(
        required=True,
        validate=[
            OneOf(
                [
                    "run",
                    "idle",
                    "down",
                    "power_off",
                    "disconnection",
                ]
            )
        ],
    )
    mode = fields.String(
        required=True,
        validate=[OneOf(["remote", "local", "offline"])],
    )
    modePosition = fields.String(
        required=False,
        load_default="top",
        validate=[OneOf(["top", "right", "bottom", "left", "hidden"])],
    )
    modeWidthPercent = fields.Float(
        required=False,
        load_default=100,
        validate=[Range(min=10, max=300)],
    )
    delayTime = fields.Float(required=False, allow_none=True, validate=[Range(min=0)])
    details = fields.Dict(keys=fields.String(), values=fields.Raw(), required=False)


class FactoryStatusAlarmSchema(Schema):
    groupName = fields.String(required=False, allow_none=True, validate=[Length(max=80)])
    deviceId = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    eqm = fields.String(required=True, validate=[Length(min=1, max=250)])
    alarmCode = fields.String(required=True, validate=[Length(min=1, max=250)])
    alarmCount = fields.Integer(required=True, validate=[Range(min=0)])
    alarmDesc = fields.String(required=False, allow_none=True, validate=[Length(max=1000)])


class FactoryStatusNodePublicUpdateSchema(Schema):
    deviceId = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(min=1, max=250)],
    )
    deviceCode = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(min=1, max=250)],
    )
    RES_ID = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    SEND_RES_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    DEVICE = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    Device = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    status = fields.String(
        required=False,
        validate=[
            OneOf(
                [
                    "run",
                    "idle",
                    "down",
                    "power_off",
                    "disconnection",
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                ]
            )
        ],
    )
    STATUS = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    mode = fields.String(
        required=False,
        validate=[OneOf(["remote", "local", "offline", "OR", "OL", "OF"])],
    )
    resId = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    statusText = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    recipe = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=500)],
    )
    downCode = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    DOWN_CODE = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    downDesc = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=1000)],
    )
    DOWN_DESC = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=1000)],
    )
    alarmId = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    ALARM_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    alarmDesc = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=1000)],
    )
    ALARM_DESC = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=1000)],
    )
    downDate = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    DOWN_DATE = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )


class FactoryStatusNodeQuantityRequestSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    deviceId = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    resId = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    RES_ID = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    SEND_RES_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    deviceCode = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )


class FactoryStatusMesBaseSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    PASSPORT = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    FACTORY = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    USERID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    PASSWORD = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    CLIENT_TIME = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    CLIENT_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    PROCSTEP = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    SEND_RES_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    RES_ID = fields.String(required=True, validate=[Length(min=1, max=250)])


class FactoryStatusMesResourceStateSchema(FactoryStatusMesBaseSchema):
    CURR_STATE_CODE = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    CURR_STATE_GROUP = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    CURR_STATE_ACRO = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    PREV_STATE_CODE = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    SUB_RES_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    ALID = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    ALCD = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    ALTX = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=1000)],
    )


class FactoryStatusMesNonOperationSchema(FactoryStatusMesBaseSchema):
    DOWN_CODE = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    COMMENTS = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=1000)],
    )


class FactoryStatusMesControlModeSchema(FactoryStatusMesBaseSchema):
    CIM_CONTROLMODE = fields.String(
        required=True,
        validate=[OneOf(["OR", "OL", "OF"])],
    )


class FactoryStatusMesRecipeSchema(FactoryStatusMesBaseSchema):
    RECIPE = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=500)],
    )


class FactoryStatusMesAlarmReportSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    DEVICE = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    Device = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    deviceId = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    RES_ID = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    SEND_RES_ID = fields.String(
        required=False,
        allow_none=True,
        validate=[Length(max=250)],
    )
    ALCD = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    ALID = fields.String(required=False, allow_none=True, validate=[Length(max=250)])
    ALTX = fields.String(required=False, allow_none=True, validate=[Length(max=1000)])


class FactoryStatusLayoutSchema(Schema):
    name = fields.String(required=True, validate=[Length(min=1, max=250)])
    width = fields.Float(required=True, validate=[Range(min=400)])
    height = fields.Float(required=True, validate=[Range(min=300)])
    nodes = fields.List(fields.Nested(FactoryStatusNodeSchema), required=True)
    alarms = fields.List(
        fields.Nested(FactoryStatusAlarmSchema),
        required=False,
        load_default=list,
    )
    updated_at = fields.String(required=False, allow_none=True)
