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
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from typing import Any

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.security.decorators import permission_name
from marshmallow import ValidationError
from sqlalchemy import inspect, text

from superset.extensions import db, event_logger
from superset.factory_status.schemas import (
    FactoryStatusLayoutSchema,
    FactoryStatusMesAlarmReportSchema,
    FactoryStatusMesControlModeSchema,
    FactoryStatusMesNonOperationSchema,
    FactoryStatusMesRecipeSchema,
    FactoryStatusMesResourceStateSchema,
    FactoryStatusNodeQuantityRequestSchema,
    FactoryStatusNodePublicUpdateSchema,
)
from superset.models.core import Database
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

DEFAULT_LAYOUT_NAME = "default"
ORACLE_PRODUCT_DATABASE_NAME = "Oracle_Product"
ALARM_GROUP_PREFIXES = ("USC", "FTR", "ISM", "AGB", "PFL")
NODE_QUANTITY_SQL = """
SELECT
    RES_ID,
    WORK_DATE,
    SUM(PROD_IN_QTY) AS Total_Qty,
    SUM(PROD_QTY) AS Total_OK,
    SUM(LOSS_QTY) AS Total_NG
FROM CSUMWIPOPR
WHERE 1=1
    AND TO_DATE(WORK_DATE, 'YYYYMMDD') = TRUNC(SYSDATE)
    AND RES_ID <> ' '
    AND RES_ID = :device_id
GROUP BY RES_ID, WORK_DATE
"""
NODE_DOWN_TIME_SQL = """
SELECT SUM(DOWN_TIME) AS DOWN_TIME
FROM CSUMDWNDAT c
WHERE c.FACTORY = 'DV01'
    AND TO_DATE(WORK_DATE, 'YYYYMMDD') = TRUNC(SYSDATE)
    AND RES_ID = :device_id
GROUP BY RES_ID, WORK_DATE
"""
NODE_WORKER_SQL = """
SELECT c.WORKER_ID, c.WORKER_DESC, c.CMF_1 AS WORKER_LEVEL
FROM CWIPWRKDEF c
WHERE c.WORKER_ID IN (
    SELECT USER_NAME
    FROM (
        SELECT USER_NAME, LOG_TIME,
            ROW_NUMBER() OVER (
                PARTITION BY A.RES_ID ORDER BY A.LOG_TIME DESC
            ) AS RN
        FROM CLOGMESDAT A
        WHERE A.LOG_TIME > TO_CHAR(SYSDATE - 1, 'YYYYMMDDHH24MISS')
            AND A.RES_ID = :device_id
    )
    WHERE RN = 1
)
"""
NODE_STATUS_SYNC_SQL = """
SELECT
    FACTORY,
    RES_ID AS EQP_ID,
    CASE
        WHEN RES_CTRL_MODE = 'OF' THEN 'power_off'
        WHEN RES_STS_1 = 'RUN' THEN 'run'
        WHEN RES_STS_1 = 'IDLE' THEN 'idle'
        WHEN RES_STS_1 = 'DOWN' THEN 'down'
        WHEN RES_STS_1 = 'PUSH' THEN 'run'
        WHEN RES_STS_1 = 'STOP' THEN 'down'
        ELSE LOWER(RES_STS_1)
    END AS status,
    CASE RES_CTRL_MODE
        WHEN 'OF' THEN 'offline'
        WHEN 'OL' THEN 'local'
        WHEN 'OR' THEN 'remote'
        ELSE LOWER(RES_CTRL_MODE)
    END AS mode_1,
    RES_CMF_2 AS recipe
FROM MRASRESDEF
WHERE FACTORY = 'DV01'
ORDER BY EQP_ID ASC
"""
RESOURCE_STATE_STATUS_BY_CODE = {
    "1": "idle",
    "2": "run",
    "3": "down",
    "4": "power_off",
    "5": "disconnection",
}
SUPPORTED_NODE_STATUSES = {
    "run",
    "idle",
    "down",
    "power_off",
    "disconnection",
}
CIM_CONTROL_MODE_BY_CODE = {
    "OF": "offline",
    "OL": "local",
    "OR": "remote",
}
SUPPORTED_NODE_MODES = {"remote", "local", "offline"}


def _default_details(
    res_id: str,
    status_text: str,
    recipe: str,
    down_code: str,
    down_desc: str,
    alarm_id: str,
    alarm_desc: str,
    down_date: str,
) -> dict[str, str]:
    return {
        "RES_ID": res_id,
        "STATUS": status_text,
        "RECIPE": recipe,
        "DOWN_CODE": down_code,
        "DOWN_DESC": down_desc,
        "ALARM_ID": alarm_id,
        "ALARM_DESC": alarm_desc,
        "DOWN_DATE": down_date,
        "EQM": res_id,
        "Alarm Code": down_code,
    }


def _default_node(
    node_id: str,
    device_code: str,
    label: str,
    node_type: str,
    x: int,
    y: int,
    width: int,
    height: int,
    status: str = "run",
    mode: str = "remote",
    mode_position: str = "top",
    mode_width_percent: int = 100,
    res_id: str = "",
    status_text: str = "",
    recipe: str = "",
    down_code: str = "",
    down_desc: str = "",
    alarm_id: str = "",
    alarm_desc: str = "",
    down_date: str = "",
) -> dict[str, Any]:
    return {
        "id": node_id,
        "deviceId": "",
        "deviceCode": device_code,
        "label": label,
        "type": node_type,
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "status": status,
        "mode": mode,
        "modePosition": mode_position,
        "modeWidthPercent": mode_width_percent,
        "details": _default_details(
            res_id or label,
            status_text or status.replace("_", " ").upper(),
            recipe,
            down_code,
            down_desc,
            alarm_id,
            alarm_desc,
            down_date,
        ),
    }


DEFAULT_FACTORY_STATUS_NODE_ROWS: tuple[tuple[Any, ...], ...] = (
    ("vpm", "VPM", "VPM", "equipment", 20, 114, 150, 68, "run", "remote", "top", 100, "VPM", "RUN", "", "", "", "", "", ""),
    ("roll-cleaner", "ROLL-CLEANER", "Roll Cleaner", "area", 20, 202, 152, 181, "run", "remote", "hidden", 100, "RollCleaner", "RUN", "", "", "", "", "", ""),
    ("roll-cleaner-1", "ROLL-CLEANER-1", "#1", "equipment", 30, 239, 65, 110, "run", "remote", "bottom", 100, "#1", "RUN", "", "", "", "", "", ""),
    ("roll-cleaner-2", "ROLL-CLEANER-2", "#2", "equipment", 100, 239, 65, 110, "idle", "remote", "bottom", 100, "#2", "IDLE", "", "", "", "", "", ""),
    ("tpm", "TPM", "TPM", "area", 180, 202, 80, 197, "run", "remote", "top", 100, "TPM", "RUN", "", "", "", "", "", ""),
    ("tpm-1", "TPM-1", "#1", "equipment", 188, 251, 64, 56, "run", "remote", "top", 100, "#1", "RUN", "", "", "", "", "", ""),
    ("tpm-2", "TPM-2", "#2", "equipment", 189, 330, 65, 63, "run", "remote", "top", 100, "#2", "RUN", "", "", "", "", "", ""),
    ("rc-1", "RC-1", "RC#1", "equipment", 272, 112, 120, 48, "power_off", "offline", "top", 100, "RC#1", "POWER OFF", "", "", "", "", "", ""),
    ("pfl-4", "PFL-4", "PFL#4", "equipment", 273, 187, 122, 48, "run", "remote", "top", 100, "PFL#4", "RUN", "", "", "", "", "", ""),
    ("pfl-1", "PFL-1", "PFL#1", "equipment", 275, 260, 122, 48, "down", "remote", "top", 100, "PFL#1", "DOWN", "", "", "", "", "", ""),
    ("acv-1", "ACV-1", "ACV#1", "equipment", 277, 338, 122, 48, "run", "remote", "top", 100, "ACV#1", "RUN", "", "", "", "", "", ""),
    ("lbs-1", "LBS-1", "L\nB\nS\n#\n1", "equipment", 412, 110, 65, 216, "idle", "remote", "top", 100, "L\nB\nS\n#\n1", "IDLE", "", "", "", "", "", ""),
    ("agb-area", "AGB-AREA", "1", "area", 484, 91, 434, 262, "run", "remote", "hidden", 100, "AGB", "RUN", "", "", "", "", "", ""),
    ("agb-1", "AGB-1", "AGB\n#1", "equipment", 497, 123, 65, 95, "power_off", "offline", "top", 100, "AGB\n#1", "POWER OFF", "", "", "", "", "", ""),
    ("agb-2", "AGB-2", "AGB\n#2", "equipment", 567, 123, 65, 95, "power_off", "offline", "top", 100, "AGB\n#2", "POWER OFF", "", "", "", "", "", ""),
    ("agb-3", "AGB-3", "AGB\n#3", "equipment", 635, 123, 65, 95, "run", "remote", "top", 100, "AGB\n#3", "RUN", "", "", "", "", "", ""),
    ("agb-4", "AGB-4", "AGB\n#4", "equipment", 706, 123, 65, 95, "down", "remote", "top", 100, "AGB\n#4", "DOWN", "", "70023", "", "", "", ""),
    ("agb-5", "AGB-5", "AGB\n#5", "equipment", 776, 123, 65, 95, "run", "remote", "top", 100, "AGB\n#5", "RUN", "", "", "", "", "", ""),
    ("agb-6", "AGB-6", "AGB\n#6", "equipment", 845, 123, 65, 95, "run", "remote", "top", 100, "AGB\n#6", "RUN", "", "", "", "", "", ""),
    ("agb-7", "AGB-7", "AGB\n#7", "equipment", 497, 229, 65, 95, "down", "remote", "bottom", 100, "AGB\n#7", "DOWN", "", "70024", "", "", "", ""),
    ("agb-8", "AGB-8", "AGB\n#8", "equipment", 567, 228, 65, 95, "run", "remote", "bottom", 100, "AGB\n#8", "RUN", "", "", "", "", "", ""),
    ("agb-9", "AGB-9", "AGB\n#9", "equipment", 635, 229, 65, 95, "run", "remote", "bottom", 100, "AGB\n#9", "RUN", "", "", "", "", "", ""),
    ("agb-10", "AGB-10", "AGB\n#10", "equipment", 706, 230, 65, 95, "run", "remote", "bottom", 100, "AGB\n#10", "RUN", "", "", "", "", "", ""),
    ("ism-area", "ISM-AREA", "1", "area", 926, 95, 302, 253, "run", "remote", "hidden", 100, "ISM", "RUN", "", "", "", "", "", ""),
    ("ism-4", "ISM-4", "ISM\n#4", "equipment", 940, 123, 65, 90, "run", "remote", "top", 100, "ISM\n#4", "RUN", "", "", "", "", "", ""),
    ("ism-3", "ISM-3", "ISM\n#3", "equipment", 1010, 123, 65, 90, "run", "remote", "top", 100, "ISM\n#3", "RUN", "", "", "", "", "", ""),
    ("ism-2", "ISM-2", "ISM\n#2", "equipment", 1080, 123, 65, 90, "run", "remote", "top", 100, "ISM\n#2", "RUN", "", "", "", "", "", ""),
    ("ism-1", "ISM-1", "ISM\n#1", "equipment", 1152, 123, 65, 90, "run", "remote", "top", 100, "ISM\n#1", "RUN", "", "", "", "", "", ""),
    ("ism-5", "ISM-5", "ISM\n#5", "equipment", 940, 243, 65, 90, "run", "remote", "top", 100, "ISM\n#5", "RUN", "", "", "", "", "", ""),
    ("ism-6", "ISM-6", "ISM\n#6", "equipment", 1010, 243, 65, 90, "run", "remote", "top", 100, "ISM\n#6", "RUN", "", "", "", "", "", ""),
    ("ism-7", "ISM-7", "ISM\n#7", "equipment", 1080, 243, 65, 90, "run", "remote", "top", 100, "ISM\n#7", "RUN", "", "", "", "", "", ""),
    ("ism-8", "ISM-8", "ISM\n#8", "equipment", 1152, 243, 65, 90, "run", "remote", "top", 100, "ISM\n#8", "RUN", "", "", "", "", "", ""),
    ("lbs-2", "LBS-2", "L\nB\nS\n#\n2", "equipment", 1235, 114, 65, 224, "idle", "remote", "top", 100, "L\nB\nS\n#\n2", "IDLE", "", "", "", "", "", ""),
    ("udr-1", "UDR-1", "UDR#1", "equipment", 527, 387, 100, 36, "idle", "remote", "top", 100, "UDR#1", "IDLE", "", "", "", "", "", ""),
    ("udi-1", "UDI-1", "UDI#1", "equipment", 686, 386, 104, 36, "run", "remote", "top", 100, "UDI#1", "RUN", "", "", "", "", "", ""),
    ("udi-2", "UDI-2", "UDI#2", "equipment", 865, 387, 104, 36, "run", "remote", "top", 100, "UDI#2", "RUN", "", "", "", "", "", ""),
    ("udi-3", "UDI-3", "UDI#3", "equipment", 1045, 385, 104, 36, "idle", "remote", "top", 100, "UDI#3", "IDLE", "", "", "", "", "", ""),
    ("pfl-3", "PFL-3", "PFL#3", "equipment", 1310, 176, 96, 48, "down", "remote", "top", 100, "PFL#3", "DOWN", "", "", "", "", "", ""),
    ("pfl-2", "PFL-2", "PFL#2", "equipment", 1309, 254, 96, 48, "run", "remote", "top", 100, "PFL#2", "RUN", "", "", "", "", "", ""),
    ("acv-2", "ACV-2", "ACV#2", "equipment", 1418, 179, 132, 48, "idle", "remote", "top", 100, "ACV#2", "IDLE", "", "", "", "", "", ""),
    ("ctcln", "CTCLN", "CTCLN", "equipment", 1422, 257, 132, 48, "idle", "remote", "top", 100, "CTCLN", "IDLE", "", "", "", "", "", ""),
    ("rcln-1", "RCLN-1", "RCLN#1", "equipment", 1566, 181, 120, 48, "run", "remote", "top", 100, "RCLN#1", "RUN", "", "", "", "", "", ""),
    ("rcln-2", "RCLN-2", "RCLN#2", "equipment", 1568, 251, 120, 48, "run", "remote", "top", 100, "RCLN#2", "RUN", "", "", "", "", "", ""),
    ("pcln-atp-2", "PCLN-ATP-2", "PCLN(ATP)#2", "equipment", 1718, 126, 138, 48, "run", "remote", "top", 100, "PCLN(ATP)#2", "RUN", "", "", "", "", "", ""),
    ("pcln-atp-1", "PCLN-ATP-1", "PCLN(ATP)#1", "equipment", 1716, 203, 138, 48, "run", "remote", "top", 100, "PCLN(ATP)#1", "RUN", "", "", "", "", "", ""),
    ("arm-4", "ARM-4", "ARM#4", "equipment", 1570, 328, 70, 48, "run", "remote", "top", 100, "ARM#4", "RUN", "", "", "", "", "", ""),
    ("arm-3", "ARM-3", "ARM#3", "equipment", 1640, 328, 70, 48, "run", "remote", "top", 100, "ARM#3", "RUN", "", "", "", "", "", ""),
    ("arm-2", "ARM-2", "ARM#2", "equipment", 1710, 328, 70, 48, "run", "remote", "top", 100, "ARM#2", "RUN", "", "", "", "", "", ""),
    ("arm-1", "ARM-1", "ARM#1", "equipment", 1780, 328, 70, 48, "run", "remote", "top", 100, "ARM#1", "RUN", "", "", "", "", "", ""),
    ("tvm", "TVM", "TVM", "area", 25, 430, 157, 115, "run", "remote", "hidden", 100, "TVM", "RUN", "", "", "", "", "", ""),
    ("tvm-1", "TVM-1", "TVM\n#1", "equipment", 34, 481, 65, 50, "run", "remote", "top", 100, "TVM\n#1", "RUN", "", "", "", "", "", ""),
    ("tvm-2", "TVM-2", "TVM\n#2", "equipment", 107, 482, 67, 48, "run", "remote", "top", 100, "TVM\n#2", "RUN", "", "", "", "", "", ""),
    ("eci-1", "ECI-1", "ECI #1", "equipment", 207, 446, 64, 54, "run", "remote", "top", 100, "ECI#1", "RUN", "", "", "", "", "", ""),
    ("eci-2", "ECI-2", "ECI #2", "equipment", 208, 531, 64, 54, "idle", "remote", "top", 100, "ECI#2", "IDLE", "", "", "", "", "", ""),
    ("eci-3", "ECI-3", "ECI #3", "equipment", 208, 613, 64, 54, "run", "remote", "top", 100, "ECI#3", "RUN", "", "", "", "", "", ""),
    ("eci-4", "ECI-4", "ECI #4", "equipment", 301, 612, 64, 54, "down", "remote", "top", 100, "ECI#4", "DOWN", "", "", "", "", "", ""),
    ("ecr-1", "ECR-1", "ECR #1", "equipment", 294, 439, 74, 54, "down", "remote", "top", 100, "ECR#1", "DOWN", "", "", "", "", "", ""),
    ("usc-area", "USC-AREA", "USC", "area", 386, 432, 175, 248, "run", "remote", "hidden", 100, "USC", "RUN", "", "", "", "", "", ""),
    ("usc-3", "USC-3", "USC#3", "equipment", 401, 463, 146, 48, "down", "remote", "top", 100, "USC#3", "DOWN", "", "237", "", "", "", ""),
    ("usc-2", "USC-2", "USC#2", "equipment", 400, 542, 146, 48, "run", "remote", "top", 100, "USC#2", "RUN", "", "", "", "", "", ""),
    ("usc-1", "USC-1", "USC#1", "equipment", 398, 619, 146, 48, "down", "remote", "top", 100, "USC#1", "DOWN", "", "", "", "", "", ""),
    ("llc-1", "LLC-1", "LLC#1", "equipment", 610, 484, 122, 54, "power_off", "offline", "top", 100, "LLC#1", "POWER OFF", "", "", "", "", "", ""),
    ("etcher-area", "ETCHER-AREA", "ETCHER", "area", 775, 450, 158, 172, "run", "remote", "hidden", 100, "ETCHER", "RUN", "", "", "", "", "", ""),
    ("etcher-1", "ETCHER-1", "ETCHER#1", "equipment", 782, 476, 142, 54, "down", "remote", "top", 100, "ETCHER#1", "DOWN", "", "", "", "", "", ""),
    ("etcher-2", "ETCHER-2", "ETCHER#2", "equipment", 782, 564, 142, 54, "run", "remote", "top", 100, "ETCHER#2", "RUN", "", "", "", "", "", ""),
    ("ftr-area", "FTR-AREA", "FTR", "area", 974, 452, 248, 144, "run", "remote", "hidden", 100, "FTR", "RUN", "", "", "", "", "", ""),
    ("ftr-3", "FTR-3", "FTR#3", "equipment", 984, 478, 104, 44, "run", "remote", "top", 100, "FTR#3", "RUN", "", "", "", "", "", ""),
    ("ftr-2", "FTR-2", "FTR#2", "equipment", 1112, 478, 96, 44, "run", "remote", "top", 100, "FTR#2", "RUN", "", "", "", "", "", ""),
    ("ftr-4", "FTR-4", "FTR#4", "equipment", 984, 548, 104, 44, "run", "remote", "top", 100, "FTR#4", "RUN", "", "", "", "", "", ""),
    ("ftr-1", "FTR-1", "FTR#1", "equipment", 1112, 548, 96, 44, "down", "remote", "top", 100, "FTR#1", "DOWN", "", "20920", "", "", "", ""),
    ("rtr-area", "RTR-AREA", "RTR", "area", 1444, 392, 430, 72, "run", "remote", "hidden", 100, "RTR", "RUN", "", "", "", "", "", ""),
    ("rtr-1", "RTR-1", "RTR#1", "equipment", 1458, 424, 62, 34, "down", "remote", "top", 100, "RTR#1", "DOWN", "", "", "", "", "", ""),
    ("rtr-2", "RTR-2", "RTR#2", "equipment", 1522, 424, 62, 34, "down", "remote", "top", 100, "RTR#2", "DOWN", "", "", "", "", "", ""),
    ("rtr-3", "RTR-3", "RTR#3", "equipment", 1586, 424, 62, 34, "power_off", "offline", "top", 100, "RTR#3", "POWER OFF", "", "", "", "", "", ""),
    ("rtr-4", "RTR-4", "RTR#4", "equipment", 1672, 424, 64, 34, "power_off", "offline", "top", 100, "RTR#4", "POWER OFF", "", "", "", "", "", ""),
    ("rtr-5", "RTR-5", "RTR#5", "equipment", 1738, 424, 64, 34, "power_off", "offline", "top", 100, "RTR#5", "POWER OFF", "", "", "", "", "", ""),
    ("rtr-6", "RTR-6", "RTR#6", "equipment", 1806, 424, 62, 34, "down", "remote", "top", 100, "RTR#6", "DOWN", "", "", "", "", "", ""),
    ("tnf-area", "TNF-AREA", "TNF", "area", 1378, 510, 494, 94, "run", "remote", "hidden", 100, "TNF", "RUN", "", "", "", "", "", ""),
    ("tnf-3", "TNF-3", "TNF#3", "equipment", 1392, 536, 156, 56, "run", "remote", "top", 100, "TNF#3", "RUN", "", "", "", "", "", ""),
    ("tnf-2", "TNF-2", "TNF#2", "equipment", 1552, 536, 156, 56, "run", "remote", "top", 100, "TNF#2", "RUN", "", "", "", "", "", ""),
    ("tnf-1", "TNF-1", "TNF#1", "equipment", 1712, 536, 156, 56, "run", "remote", "top", 100, "TNF#1", "RUN", "", "", "", "", "", ""),
)

DEFAULT_FACTORY_STATUS_LAYOUT: dict[str, Any] = {
    "name": DEFAULT_LAYOUT_NAME,
    "width": 1880,
    "height": 680,
    "nodes": [_default_node(*node) for node in DEFAULT_FACTORY_STATUS_NODE_ROWS],
    "alarms": [],
    "updated_at": None,
}

factory_status_layout_schema = FactoryStatusLayoutSchema()
factory_status_node_public_update_schema = FactoryStatusNodePublicUpdateSchema()
factory_status_node_quantity_request_schema = FactoryStatusNodeQuantityRequestSchema()
factory_status_mes_alarm_report_schema = FactoryStatusMesAlarmReportSchema()
factory_status_mes_control_mode_schema = FactoryStatusMesControlModeSchema()
factory_status_mes_recipe_schema = FactoryStatusMesRecipeSchema()
factory_status_mes_resource_state_schema = FactoryStatusMesResourceStateSchema()
factory_status_mes_non_operation_schema = FactoryStatusMesNonOperationSchema()


def _node_metric_select_columns() -> str:
    column_names = {
        column["name"]
        for column in inspect(db.session.get_bind()).get_columns(
            "factory_status_nodes"
        )
    }
    daily_output_column = (
        "daily_output_qty"
        if "daily_output_qty" in column_names
        else "NULL AS daily_output_qty"
    )
    daily_ng_column = (
        "daily_ng_qty" if "daily_ng_qty" in column_names else "NULL AS daily_ng_qty"
    )
    delay_time_column = (
        "delay_time" if "delay_time" in column_names else "NULL AS delay_time"
    )
    return f"{daily_output_column}, {daily_ng_column}, {delay_time_column}"


def _status_text(status: str) -> str:
    return status.replace("_", " ").upper()


def _clean_mes_value(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _row_value(row: dict[str, Any], key: str) -> Any:
    for row_key, value in row.items():
        if str(row_key).upper() == key:
            return value
    return None


def _clean_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _format_mes_datetime(value: Any) -> str:
    text_value = _clean_mes_value(value)
    if len(text_value) >= 14 and text_value[:14].isdigit():
        return (
            f"{text_value[0:4]}-{text_value[4:6]}-{text_value[6:8]} "
            f"{text_value[8:10]}:{text_value[10:12]}:{text_value[12:14]}"
        )
    return text_value


def _mes_device_id(payload: dict[str, Any]) -> str:
    return _clean_mes_value(
        payload.get("RES_ID")
        or payload.get("SEND_RES_ID")
        or payload.get("DEVICE")
        or payload.get("Device")
        or payload.get("deviceId")
    )


def _resource_state_status(payload: dict[str, Any]) -> str:
    state_text = " ".join(
        _clean_mes_value(payload.get(key)).upper()
        for key in ("CURR_STATE_GROUP", "CURR_STATE_ACRO")
    )
    if any(token in state_text for token in ("DISCONNECTION", "DISCONNECT", "COMM")):
        return "disconnection"
    if any(token in state_text for token in ("POWER", "OFF")):
        return "power_off"
    if any(token in state_text for token in ("DOWN", "ALARM", "STOP", "NON")):
        return "down"
    if any(token in state_text for token in ("IDLE", "STANDBY", "WAIT")):
        return "idle"
    if any(token in state_text for token in ("RUN", "PRODUCT", "PROCESS")):
        return "run"
    return RESOURCE_STATE_STATUS_BY_CODE.get(
        _clean_mes_value(payload.get("CURR_STATE_CODE")),
        "run",
    )


def _resource_state_status_text(payload: dict[str, Any]) -> str:
    for key in ("CURR_STATE_ACRO", "CURR_STATE_GROUP", "CURR_STATE_CODE"):
        value = _clean_mes_value(payload.get(key))
        if value:
            return value
    return ""


def _normalize_status_value(value: Any) -> str:
    text_value = _clean_mes_value(value).lower()
    normalized_value = RESOURCE_STATE_STATUS_BY_CODE.get(text_value, text_value)
    return normalized_value if normalized_value in SUPPORTED_NODE_STATUSES else "down"


def _normalize_mode_value(value: Any) -> str:
    text_value = _clean_mes_value(value)
    normalized_value = CIM_CONTROL_MODE_BY_CODE.get(text_value.upper(), text_value.lower())
    return normalized_value if normalized_value in SUPPORTED_NODE_MODES else "offline"


def _down_desc_from_code(down_code: str) -> str:
    if not down_code:
        return ""
    row = db.session.execute(
        text(
            """
            SELECT down_desc
            FROM factory_status_down_codes
            WHERE down_code = :down_code
            """
        ),
        {"down_code": down_code},
    ).mappings().one_or_none()
    return str(row["down_desc"]) if row else ""


def _detail_value(
    details: dict[str, Any],
    keys: list[str],
    fallback: str = "",
) -> str:
    for key in keys:
        if key in details and details[key] is not None:
            return str(details[key])
    return fallback


def _node_to_payload(node: dict[str, Any]) -> dict[str, Any]:
    fallback_label = node["label"] or node["device_code"] or node["node_id"]
    details = {
        "RES_ID": node["res_id"] or fallback_label,
        "STATUS": node["status_text"] or _status_text(node["status"]),
        "RECIPE": node["recipe"] or "",
        "DOWN_CODE": node["down_code"] or "",
        "DOWN_DESC": node["down_desc"] or "",
        "ALARM_ID": node["alarm_id"] or "",
        "ALARM_DESC": node["alarm_desc"] or "",
        "DOWN_DATE": node["down_date"] or "",
        "TOTAL_CELL": node.get("daily_output_qty") or "",
        "TOTAL_CELL_NG": node.get("daily_ng_qty") or "",
        "DELAY_TIME": node.get("delay_time") or "",
        "EQM": node["res_id"] or fallback_label,
        "Alarm Code": node["down_code"] or "",
    }

    return {
        "id": node["node_id"],
        "deviceId": node["device_id"],
        "deviceCode": node["device_code"],
        "label": node["label"],
        "type": node["type"],
        "x": node["x"],
        "y": node["y"],
        "width": node["width"],
        "height": node["height"],
        "status": node["status"],
        "mode": node["mode"],
        "modePosition": node["mode_position"],
        "modeWidthPercent": node["mode_width_percent"],
        "delayTime": node.get("delay_time"),
        "details": details,
    }


def _node_values_from_payload(
    payload: dict[str, Any],
    sort_order: int,
) -> dict[str, Any]:
    details = payload.get("details") or {}
    status = payload["status"]
    label = payload.get("label")
    fallback_label = label or payload.get("deviceCode") or payload["id"]
    device_code = payload.get("deviceCode") or _detail_value(
        details,
        ["DEVICE_CODE", "Device Code", "device_code"],
        payload["id"],
    )

    return {
        "node_id": payload["id"],
        "device_id": payload.get("deviceId") or _detail_value(
            details,
            ["DEVICE_ID", "Device ID", "device_id"],
            device_code,
        ),
        "device_code": device_code,
        "label": label,
        "type": payload["type"],
        "x": payload["x"],
        "y": payload["y"],
        "width": payload["width"],
        "height": payload["height"],
        "status": status,
        "mode": payload["mode"],
        "mode_position": payload.get("modePosition") or "top",
        "mode_width_percent": payload.get("modeWidthPercent") or 100,
        "sort_order": sort_order,
        "res_id": _detail_value(
            details,
            ["RES_ID", "EQM", "res_id"],
            fallback_label,
        ),
        "status_text": _detail_value(
            details,
            ["STATUS", "Status", "status"],
            _status_text(status),
        ),
        "recipe": _detail_value(details, ["RECIPE", "Recipe", "recipe"]),
        "down_code": _detail_value(
            details,
            ["DOWN_CODE", "Down Code", "Alarm Code", "alarm_code"],
        ),
        "down_desc": _detail_value(details, ["DOWN_DESC", "Down Desc", "down_desc"]),
        "alarm_id": _detail_value(details, ["ALARM_ID", "Alarm ID", "alarm_id"]),
        "alarm_desc": _detail_value(
            details,
            ["ALARM_DESC", "Alarm Desc", "alarm_desc"],
        ),
        "down_date": _detail_value(details, ["DOWN_DATE", "Down Date", "down_date"]),
    }


def _alarm_group_from_eqm(eqm: str) -> str:
    upper_eqm = eqm.upper()
    for prefix in ALARM_GROUP_PREFIXES:
        if upper_eqm.startswith(prefix):
            return prefix
    return upper_eqm[:3] or "OTHER"


def _alarm_to_payload(alarm: dict[str, Any]) -> dict[str, Any]:
    return {
        "groupName": alarm["group_name"],
        "deviceId": alarm["device_id"],
        "eqm": alarm["eqm"],
        "model": alarm.get("model"),
        "alarmCode": alarm["alarm_code"],
        "alarmCount": alarm["alarm_count"],
        "alarmDesc": alarm["alarm_desc"],
    }


def _alarm_values_from_payload(
    payload: dict[str, Any],
    sort_order: int,
) -> dict[str, Any]:
    eqm = payload["eqm"]
    return {
        "group_name": payload.get("groupName") or _alarm_group_from_eqm(eqm),
        "device_id": payload.get("deviceId"),
        "eqm": eqm,
        "model": payload.get("model"),
        "alarm_code": payload["alarmCode"],
        "alarm_count": payload["alarmCount"],
        "alarm_desc": payload.get("alarmDesc"),
        "sort_order": sort_order,
    }


def _merged_alarm_payloads(alarms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[tuple[str, str, str], dict[str, Any]] = {}
    for alarm in alarms:
        eqm = alarm["eqm"]
        group_name = alarm.get("groupName") or _alarm_group_from_eqm(eqm)
        alarm_code = alarm["alarmCode"]
        key = (group_name, eqm, alarm_code)
        if key not in merged:
            merged[key] = {
                "groupName": group_name,
                "deviceId": alarm.get("deviceId"),
                "eqm": eqm,
                "alarmCode": alarm_code,
                "alarmCount": alarm["alarmCount"],
                "alarmDesc": alarm.get("alarmDesc"),
            }
        else:
            merged[key]["alarmCount"] += alarm["alarmCount"]
            merged[key]["deviceId"] = merged[key]["deviceId"] or alarm.get("deviceId")
            merged[key]["alarmDesc"] = merged[key]["alarmDesc"] or alarm.get("alarmDesc")

    return sorted(
        merged.values(),
        key=lambda alarm: (
            alarm["groupName"],
            -alarm["alarmCount"],
            alarm["eqm"],
            alarm["alarmCode"],
        ),
    )


def _insert_node(layout_id: int, node_payload: dict[str, Any], sort_order: int) -> None:
    values = _node_values_from_payload(node_payload, sort_order)
    values["layout_id"] = layout_id
    values["now"] = datetime.utcnow()
    db.session.execute(
        text(
            """
            INSERT INTO factory_status_nodes (
                created_on, changed_on, layout_id, node_id, device_id,
                device_code, label,
                type, x, y, width, height, status, mode, mode_position,
                mode_width_percent, sort_order, res_id, status_text, recipe,
                down_code, down_desc, alarm_id, alarm_desc, down_date
            ) VALUES (
                :now, :now, :layout_id, :node_id, :device_id,
                :device_code, :label,
                :type, :x, :y, :width, :height, :status, :mode, :mode_position,
                :mode_width_percent, :sort_order, :res_id, :status_text, :recipe,
                :down_code, :down_desc, :alarm_id, :alarm_desc, :down_date
            )
            """
        ),
        values,
    )


def _insert_alarm(
    layout_id: int,
    alarm_payload: dict[str, Any],
    sort_order: int,
) -> None:
    values = _alarm_values_from_payload(alarm_payload, sort_order)
    values["layout_id"] = layout_id
    values["now"] = datetime.utcnow()
    values["user_id"] = getattr(getattr(g, "user", None), "id", None)
    db.session.execute(
        text(
            """
            INSERT INTO factory_status_alarms (
                created_on, changed_on, layout_id, device_id, group_name, eqm,
                model, alarm_code, alarm_count, alarm_desc, sort_order,
                created_by_fk, changed_by_fk
            ) VALUES (
                :now, :now, :layout_id, :device_id, :group_name, :eqm,
                :model, :alarm_code, :alarm_count, :alarm_desc, :sort_order,
                :user_id, :user_id
            )
            """
        ),
        values,
    )


def _update_node(node_id: int, node_payload: dict[str, Any], sort_order: int) -> None:
    values = _node_values_from_payload(node_payload, sort_order)
    values["id"] = node_id
    values["now"] = datetime.utcnow()
    db.session.execute(
        text(
            """
            UPDATE factory_status_nodes
            SET changed_on = :now,
                node_id = :node_id,
                device_id = :device_id,
                device_code = :device_code,
                label = :label,
                type = :type,
                x = :x,
                y = :y,
                width = :width,
                height = :height,
                status = :status,
                mode = :mode,
                mode_position = :mode_position,
                mode_width_percent = :mode_width_percent,
                sort_order = :sort_order,
                res_id = :res_id,
                status_text = :status_text,
                recipe = :recipe,
                down_code = :down_code,
                down_desc = :down_desc,
                alarm_id = :alarm_id,
                alarm_desc = :alarm_desc,
                down_date = :down_date
            WHERE id = :id
            """
        ),
        values,
    )


def _create_layout_from_payload(payload: dict[str, Any]) -> int:
    now = datetime.utcnow()
    db.session.execute(
        text(
            """
            INSERT INTO factory_status_layouts (
                created_on, changed_on, name, width, height
            ) VALUES (
                :now, :now, :name, :width, :height
            )
            """
        ),
        {
            "now": now,
            "name": payload["name"],
            "width": payload["width"],
            "height": payload["height"],
        },
    )
    layout = _get_layout_by_name(payload["name"])
    if layout is None:
        raise RuntimeError("Factory status layout was not created")

    layout_id = int(layout["id"])
    for sort_order, node_payload in enumerate(payload["nodes"]):
        _insert_node(layout_id, node_payload, sort_order)
    for sort_order, alarm_payload in enumerate(
        _merged_alarm_payloads(payload.get("alarms", []))
    ):
        _insert_alarm(layout_id, alarm_payload, sort_order)
    return layout_id


def _get_layout_by_name(name: str) -> dict[str, Any] | None:
    row = db.session.execute(
        text(
            """
            SELECT id, name, width, height, changed_on, created_by_fk, changed_by_fk
            FROM factory_status_layouts
            WHERE name = :name
            """
        ),
        {"name": name},
    ).mappings().one_or_none()
    return dict(row) if row else None


def _get_or_create_layout() -> dict[str, Any]:
    layout = _get_layout_by_name(DEFAULT_LAYOUT_NAME)
    if layout is None:
        layout_id = _create_layout_from_payload(DEFAULT_FACTORY_STATUS_LAYOUT)
        db.session.commit()  # pylint: disable=consider-using-transaction
        row = db.session.execute(
            text(
                """
                SELECT id, name, width, height, changed_on, created_by_fk, changed_by_fk
                FROM factory_status_layouts
                WHERE id = :id
                """
            ),
            {"id": layout_id},
        ).mappings().one()
        layout = dict(row)
    return layout


def _layout_to_payload(layout: dict[str, Any]) -> dict[str, Any]:
    metric_columns = _node_metric_select_columns()
    nodes = db.session.execute(
        text(
            f"""
            SELECT id, layout_id, node_id, device_id, device_code, label, type,
                   x, y, width, height, status, mode, mode_position,
                   mode_width_percent, sort_order, res_id, status_text, recipe,
                   down_code, down_desc, alarm_id, alarm_desc, down_date,
                   {metric_columns}
            FROM factory_status_nodes
            WHERE layout_id = :layout_id
            ORDER BY sort_order
            """
        ),
        {"layout_id": layout["id"]},
    ).mappings().all()
    alarms = db.session.execute(
        text(
            """
            SELECT id, layout_id, device_id, group_name, eqm, model, alarm_code,
                   alarm_count, alarm_desc, sort_order
            FROM factory_status_alarms
            WHERE layout_id = :layout_id
            ORDER BY group_name, alarm_count DESC, sort_order, eqm, alarm_code
            """
        ),
        {"layout_id": layout["id"]},
    ).mappings().all()
    updated_at = layout["changed_on"]
    if updated_at:
        updated_at = updated_at.isoformat()

    return {
        "name": layout["name"],
        "width": layout["width"],
        "height": layout["height"],
        "nodes": [_node_to_payload(dict(node)) for node in nodes],
        "alarms": [_alarm_to_payload(dict(alarm)) for alarm in alarms],
        "updated_at": updated_at,
    }


def _get_existing_nodes(layout_id: int) -> dict[str, dict[str, Any]]:
    rows = db.session.execute(
        text(
            """
            SELECT id, node_id
            FROM factory_status_nodes
            WHERE layout_id = :layout_id
            """
        ),
        {"layout_id": layout_id},
    ).mappings().all()
    return {row["node_id"]: dict(row) for row in rows}


def _delete_removed_nodes(layout_id: int, requested_node_ids: set[str]) -> None:
    existing_nodes = _get_existing_nodes(layout_id)
    for node_id, row in existing_nodes.items():
        if node_id not in requested_node_ids:
            db.session.execute(
                text(
                    """
                    DELETE FROM factory_status_nodes
                    WHERE id = :id
                    """
                ),
                {"id": row["id"]},
            )


def _replace_alarms(layout_id: int, payload: dict[str, Any]) -> None:
    if "alarms" not in payload:
        return

    db.session.execute(
        text(
            """
            DELETE FROM factory_status_alarms
            WHERE layout_id = :layout_id
            """
        ),
        {"layout_id": layout_id},
    )
    for sort_order, alarm_payload in enumerate(_merged_alarm_payloads(payload["alarms"])):
        _insert_alarm(layout_id, alarm_payload, sort_order)


def _public_node_update_values(payload: dict[str, Any]) -> dict[str, Any]:
    column_by_payload_key = {
        "status": "status",
        "STATUS": "status",
        "mode": "mode",
        "resId": "res_id",
        "RES_ID": "res_id",
        "statusText": "status_text",
        "recipe": "recipe",
        "downCode": "down_code",
        "DOWN_CODE": "down_code",
        "downDesc": "down_desc",
        "DOWN_DESC": "down_desc",
        "alarmId": "alarm_id",
        "ALARM_ID": "alarm_id",
        "alarmDesc": "alarm_desc",
        "ALARM_DESC": "alarm_desc",
        "downDate": "down_date",
        "DOWN_DATE": "down_date",
    }
    values = {
        column: payload[key]
        for key, column in column_by_payload_key.items()
        if key in payload
    }
    if "status" in values:
        values["status"] = _normalize_status_value(values["status"])
    if "mode" in values:
        values["mode"] = _normalize_mode_value(values["mode"])
    if "status" in values and "status_text" not in values:
        values["status_text"] = _status_text(values["status"])
    if "down_date" in values:
        values["down_date"] = _format_mes_datetime(values["down_date"]) or None
    return values


def _set_clean_payload_value(
    result: dict[str, Any],
    payload: dict[str, Any],
    source_key: str,
    target_key: str,
) -> None:
    if source_key in payload:
        result[target_key] = _clean_mes_value(payload.get(source_key)) or None


def _mes_resource_state_public_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = {"deviceId": _mes_device_id(payload)}
    if any(
        key in payload
        for key in ("CURR_STATE_CODE", "CURR_STATE_GROUP", "CURR_STATE_ACRO")
    ):
        status = _resource_state_status(payload)
        result["status"] = status
        result["statusText"] = _resource_state_status_text(payload) or _status_text(
            status
        )
    return result


def _mes_non_operation_public_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = {"deviceId": _mes_device_id(payload)}
    _set_clean_payload_value(result, payload, "RES_ID", "resId")
    _set_clean_payload_value(result, payload, "DOWN_CODE", "downCode")
    if "DOWN_CODE" in payload:
        result["downDesc"] = _down_desc_from_code(
            _clean_mes_value(payload.get("DOWN_CODE"))
        ) or None
    if "CLIENT_TIME" in payload:
        result["downDate"] = _format_mes_datetime(payload.get("CLIENT_TIME")) or None
    return result


def _mes_control_mode_public_payload(payload: dict[str, Any]) -> dict[str, Any]:
    control_mode = _clean_mes_value(payload.get("CIM_CONTROLMODE")).upper()
    result = {
        "deviceId": _mes_device_id(payload),
        "mode": CIM_CONTROL_MODE_BY_CODE[control_mode],
    }
    if control_mode == "OF":
        result["status"] = "power_off"
    return result


def _insert_cim_controlmode_history(payload: dict[str, Any]) -> None:
    res_id = _clean_mes_value(payload.get("RES_ID"))
    cim_controlmode = _clean_mes_value(payload.get("CIM_CONTROLMODE")).upper()
    status = CIM_CONTROL_MODE_BY_CODE.get(cim_controlmode, cim_controlmode.lower())
    utc_plus_7 = timezone(timedelta(hours=7))
    created_on = datetime.now(utc_plus_7)
    db.session.execute(
        text(
            """
            INSERT INTO factory_status_cim_controlmode_history
                (created_on, res_id, cim_controlmode, status)
            VALUES
                (:created_on, :res_id, :cim_controlmode, :status)
            """
        ),
        {
            "created_on": created_on,
            "res_id": res_id,
            "cim_controlmode": cim_controlmode,
            "status": status,
        },
    )


def _mes_alarm_report_public_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = {"deviceId": _mes_device_id(payload)}
    _set_clean_payload_value(result, payload, "ALID", "alarmId")
    _set_clean_payload_value(result, payload, "ALTX", "alarmDesc")
    return result


def _mes_recipe_public_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = {"deviceId": _mes_device_id(payload)}
    _set_clean_payload_value(result, payload, "RECIPE", "recipe")
    return result


def _public_node_identifier(payload: dict[str, Any]) -> str:
    return _clean_mes_value(
        payload.get("deviceId")
        or payload.get("resId")
        or payload.get("deviceCode")
        or payload.get("RES_ID")
        or payload.get("SEND_RES_ID")
        or payload.get("DEVICE")
        or payload.get("Device")
    )


def _get_oracle_product_database() -> Database:
    database = (
        db.session.query(Database)
        .filter(Database.database_name == ORACLE_PRODUCT_DATABASE_NAME)
        .one_or_none()
    )
    if database is None:
        raise RuntimeError(
            "Superset database connection "
            f"'{ORACLE_PRODUCT_DATABASE_NAME}' does not exist"
        )
    return database


def _node_quantity_payload(device_id: str) -> dict[str, Any]:
    database = _get_oracle_product_database()
    with database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            row = (
                connection.execute(
                    text(NODE_QUANTITY_SQL),
                    {"device_id": device_id},
                )
                .mappings()
                .one_or_none()
            )

    if row is None:
        return {
            "resId": device_id,
            "workDate": "",
            "totalQty": 0,
            "totalOk": 0,
            "totalNg": 0,
        }

    row_dict = dict(row)
    return {
        "resId": _clean_mes_value(_row_value(row_dict, "RES_ID")) or device_id,
        "workDate": _clean_mes_value(_row_value(row_dict, "WORK_DATE")),
        "totalQty": _clean_int(_row_value(row_dict, "TOTAL_QTY")),
        "totalOk": _clean_int(_row_value(row_dict, "TOTAL_OK")),
        "totalNg": _clean_int(_row_value(row_dict, "TOTAL_NG")),
    }


def _node_down_time_payload(device_id: str) -> dict[str, Any]:
    database = _get_oracle_product_database()
    with database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            row = (
                connection.execute(
                    text(NODE_DOWN_TIME_SQL),
                    {"device_id": device_id},
                )
                .mappings()
                .one_or_none()
            )

    if row is None:
        return {
            "resId": device_id,
            "downTime": 0,
        }

    return {
        "resId": device_id,
        "downTime": _clean_int(_row_value(dict(row), "DOWN_TIME")),
    }


def _node_worker_payload(device_id: str) -> dict[str, Any]:
    database = _get_oracle_product_database()
    with database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            row = (
                connection.execute(
                    text(NODE_WORKER_SQL),
                    {"device_id": device_id},
                )
                .mappings()
                .first()
            )

    if row is None:
        return {
            "resId": device_id,
            "workerId": "",
            "workerDesc": "",
            "workerLevel": "",
        }

    row_dict = dict(row)
    return {
        "resId": device_id,
        "workerId": _clean_mes_value(_row_value(row_dict, "WORKER_ID")),
        "workerDesc": _clean_mes_value(_row_value(row_dict, "WORKER_DESC")),
        "workerLevel": _clean_mes_value(_row_value(row_dict, "WORKER_LEVEL")),
    }


def _fetch_node_status_sync_rows() -> list[dict[str, Any]]:
    database = _get_oracle_product_database()
    with database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            result = connection.execute(text(NODE_STATUS_SYNC_SQL))
            return [dict(row) for row in result.mappings().all()]


def _sync_node_status_rows(
    layout: dict[str, Any],
    rows: list[dict[str, Any]],
) -> dict[str, int]:
    updated = 0
    skipped = 0
    now = datetime.utcnow()

    for row in rows:
        eqp_id = _clean_mes_value(_row_value(row, "EQP_ID"))
        if not eqp_id:
            skipped += 1
            continue

        status = _normalize_status_value(_row_value(row, "STATUS"))
        mode = _normalize_mode_value(_row_value(row, "MODE_1"))
        recipe = _clean_mes_value(_row_value(row, "RECIPE"))

        result = db.session.execute(
            text(
                """
                UPDATE factory_status_nodes
                SET changed_on = :now,
                    status = :status,
                    status_text = :status_text,
                    mode = :mode,
                    recipe = :recipe
                WHERE layout_id = :layout_id
                  AND (
                      device_id = :eqp_id
                      OR device_code = :eqp_id
                      OR res_id = :eqp_id
                  )
                """
            ),
            {
                "now": now,
                "layout_id": layout["id"],
                "eqp_id": eqp_id,
                "status": status,
                "status_text": _status_text(status),
                "mode": mode,
                "recipe": recipe,
            },
        )
        if result.rowcount:
            updated += int(result.rowcount)
        else:
            skipped += 1

    if updated:
        db.session.execute(
            text(
                """
                UPDATE factory_status_layouts
                SET changed_on = :now
                WHERE id = :layout_id
                """
            ),
            {"layout_id": layout["id"], "now": now},
        )

    return {
        "rows": len(rows),
        "updated": updated,
        "skipped": skipped,
    }


def _get_node_by_device_id(layout_id: int, device_id: str) -> dict[str, Any] | None:
    metric_columns = _node_metric_select_columns()
    row = db.session.execute(
        text(
            f"""
            SELECT id, layout_id, node_id, device_id, device_code, label, type,
                   x, y, width, height, status, mode, mode_position,
                   mode_width_percent, sort_order, res_id, status_text, recipe,
                   down_code, down_desc, alarm_id, alarm_desc, down_date,
                   {metric_columns}
            FROM factory_status_nodes
            WHERE layout_id = :layout_id
              AND (
                  device_id = :device_id
                  OR device_code = :device_id
                  OR res_id = :device_id
              )
            """
        ),
        {"layout_id": layout_id, "device_id": device_id},
    ).mappings().one_or_none()
    return dict(row) if row else None


def _update_node_public_payload(
    layout: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    device_id = _public_node_identifier(payload)
    if not device_id:
        return None

    node = _get_node_by_device_id(layout["id"], device_id)
    if node is None:
        return None

    values = _public_node_update_values(payload)
    if not values:
        return node

    values["id"] = node["id"]
    values["layout_id"] = layout["id"]
    values["now"] = datetime.utcnow()
    assignments = ", ".join(
        f"{column} = :{column}"
        for column in values
        if column not in {"id", "layout_id", "now"}
    )
    db.session.execute(
        text(
            f"""
            UPDATE factory_status_nodes
            SET changed_on = :now,
                {assignments}
            WHERE id = :id
            """
        ),
        values,
    )
    db.session.execute(
        text(
            """
            UPDATE factory_status_layouts
            SET changed_on = :now
            WHERE id = :layout_id
            """
        ),
        values,
    )
    updated_node = _get_node_by_device_id(layout["id"], device_id)
    if updated_node is None:
        return None
    return updated_node


def _update_layout(
    layout: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    user_id = getattr(getattr(g, "user", None), "id", None)
    db.session.execute(
        text(
            """
            UPDATE factory_status_layouts
            SET changed_on = :now,
                width = :width,
                height = :height,
                changed_by_fk = :changed_by_fk,
                created_by_fk = COALESCE(created_by_fk, :created_by_fk)
            WHERE id = :id
            """
        ),
        {
            "id": layout["id"],
            "now": datetime.utcnow(),
            "width": payload["width"],
            "height": payload["height"],
            "changed_by_fk": user_id,
            "created_by_fk": user_id,
        },
    )

    existing_nodes = _get_existing_nodes(layout["id"])
    requested_node_ids = {node_payload["id"] for node_payload in payload["nodes"]}
    for sort_order, node_payload in enumerate(payload["nodes"]):
        node = existing_nodes.get(node_payload["id"])
        if node is None:
            _insert_node(layout["id"], node_payload, sort_order)
        else:
            _update_node(node["id"], node_payload, sort_order)

    _delete_removed_nodes(layout["id"], requested_node_ids)
    _replace_alarms(layout["id"], payload)


class FactoryStatusRestApi(BaseSupersetApi):
    """API for the editable factory status page layout."""

    resource_name = "factory_status"
    allow_browser_login = True
    csrf_exempt = True
    class_permission_name = "FactoryStatus"
    openapi_spec_tag = "Factory Status"
    openapi_spec_component_schemas = (
        FactoryStatusLayoutSchema,
        FactoryStatusMesAlarmReportSchema,
        FactoryStatusMesControlModeSchema,
        FactoryStatusMesNonOperationSchema,
        FactoryStatusMesRecipeSchema,
        FactoryStatusMesResourceStateSchema,
        FactoryStatusNodeQuantityRequestSchema,
        FactoryStatusNodePublicUpdateSchema,
    )

    @expose("/", methods=("GET",))
    @safe
    @statsd_metrics
    def get_layout(self) -> Response:
        """Get the factory status layout.
        ---
        get:
          summary: Get the factory status layout
          responses:
            200:
              description: Factory status layout
            401:
              $ref: '#/components/responses/401'
        """
        model = _get_or_create_layout()
        return self.response(200, result=_layout_to_payload(model))

    @expose("/public/eapmes/node/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def update_node_public(self) -> Response:
        """Update one factory status node by device ID without authentication.
        ---
        post:
          summary: Update one factory status node by device ID
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusNodePublicUpdateSchema'
          responses:
            200:
              description: Factory status node updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            payload = factory_status_node_public_update_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        if not _public_node_identifier(payload):
            return self.response_400(message="Missing device identifier")

        layout = _get_or_create_layout()
        node = _update_node_public_payload(layout, payload)
        if node is None:
            return self.response_404()

        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=_node_to_payload(node))

    @expose("/public/eapmes/node_quantity/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def get_node_quantity(self) -> Response:
        """Get node quantity from Oracle_Product by device ID.
        ---
        post:
          summary: Get node quantity from Oracle_Product by device ID
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusNodeQuantityRequestSchema'
          responses:
            200:
              description: Factory status node quantity
            400:
              $ref: '#/components/responses/400'
        """
        try:
            payload = factory_status_node_quantity_request_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        device_id = _public_node_identifier(payload)
        if not device_id:
            return self.response_400(message="Missing device identifier")

        return self.response(200, result=_node_quantity_payload(device_id))

    @expose("/public/eapmes/node_down_time/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def get_node_down_time(self) -> Response:
        """Get node down time from Oracle_Product by device ID.
        ---
        post:
          summary: Get node down time from Oracle_Product by device ID
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusNodeQuantityRequestSchema'
          responses:
            200:
              description: Factory status node down time
            400:
              $ref: '#/components/responses/400'
        """
        try:
            payload = factory_status_node_quantity_request_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        device_id = _public_node_identifier(payload)
        if not device_id:
            return self.response_400(message="Missing device identifier")

        return self.response(200, result=_node_down_time_payload(device_id))

    @expose("/public/eapmes/node_worker/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def get_node_worker(self) -> Response:
        """Get the latest worker for a node from Oracle_Product by device ID.
        ---
        post:
          summary: Get the latest worker for a node from Oracle_Product by device ID
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusNodeQuantityRequestSchema'
          responses:
            200:
              description: Factory status node worker
            400:
              $ref: '#/components/responses/400'
        """
        try:
            payload = factory_status_node_quantity_request_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        device_id = _public_node_identifier(payload)
        if not device_id:
            return self.response_400(message="Missing device identifier")

        return self.response(200, result=_node_worker_payload(device_id))

    @expose("/sync_status/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    def sync_node_status(self) -> Response:
        """Sync factory status nodes from Oracle_Product.
        ---
        post:
          summary: Sync node status, mode, and recipe from Oracle_Product
          responses:
            200:
              description: Factory status nodes synced
            500:
              $ref: '#/components/responses/500'
        """
        layout = _get_or_create_layout()
        rows = _fetch_node_status_sync_rows()
        result = _sync_node_status_rows(layout, rows)
        db.session.commit()  # pylint: disable=consider-using-transaction
        refreshed_layout = _get_or_create_layout()
        return self.response(
            200,
            result={
                **result,
                "layout": _layout_to_payload(refreshed_layout),
            },
        )

    @expose("/public/eapmes/alarm_report_send/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def update_mes_alarm_report(self) -> Response:
        """Update one factory status node from AlarmReportSend.
        ---
        post:
          summary: Update one node alarm fields from AlarmReportSend
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusMesAlarmReportSchema'
          responses:
            200:
              description: Factory status node alarm fields updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            mes_payload = factory_status_mes_alarm_report_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        public_payload = _mes_alarm_report_public_payload(mes_payload)
        if not public_payload["deviceId"]:
            return self.response_400(message="Missing device identifier")

        layout = _get_or_create_layout()
        node = _update_node_public_payload(layout, public_payload)
        if node is None:
            return self.response_404()

        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=_node_to_payload(node))

    @expose("/public/eapmes/recipe/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def update_mes_recipe(self) -> Response:
        """Update one factory status node recipe.
        ---
        post:
          summary: Update one node recipe
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusMesRecipeSchema'
          responses:
            200:
              description: Factory status node recipe updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            mes_payload = factory_status_mes_recipe_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        public_payload = _mes_recipe_public_payload(mes_payload)
        if not public_payload["deviceId"]:
            return self.response_400(message="Missing device identifier")

        layout = _get_or_create_layout()
        node = _update_node_public_payload(layout, public_payload)
        if node is None:
            return self.response_404()

        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=_node_to_payload(node))

    @expose("/public/eapmes/cim_controlmode/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def update_mes_control_mode(self) -> Response:
        """Update one factory status node from CIM_CONTROLMODE.
        ---
        post:
          summary: Update one node mode from CIM_CONTROLMODE
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusMesControlModeSchema'
          responses:
            200:
              description: Factory status node mode updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            mes_payload = factory_status_mes_control_mode_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        layout = _get_or_create_layout()
        node = _update_node_public_payload(
            layout,
            _mes_control_mode_public_payload(mes_payload),
        )
        if node is None:
            return self.response_404()

        _insert_cim_controlmode_history(mes_payload)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=_node_to_payload(node))

    @expose("/public/eapmes/change_resource_state/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def update_mes_resource_state(self) -> Response:
        """Update one factory status node from EAPMES_Change_Resource_State.
        ---
        post:
          summary: Update one node from EAPMES_Change_Resource_State
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusMesResourceStateSchema'
          responses:
            200:
              description: Factory status node updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            mes_payload = factory_status_mes_resource_state_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        layout = _get_or_create_layout()
        node = _update_node_public_payload(
            layout,
            _mes_resource_state_public_payload(mes_payload),
        )
        if node is None:
            return self.response_404()

        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=_node_to_payload(node))

    @expose("/public/eapmes/non_operation/", methods=("POST",))
    @safe
    @statsd_metrics
    @requires_json
    def update_mes_non_operation(self) -> Response:
        """Update one factory status node from EAPMES_Non_Operation.
        ---
        post:
          summary: Update one node from EAPMES_Non_Operation
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusMesNonOperationSchema'
          responses:
            200:
              description: Factory status node updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            mes_payload = factory_status_mes_non_operation_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        layout = _get_or_create_layout()
        node = _update_node_public_payload(
            layout,
            _mes_non_operation_public_payload(mes_payload),
        )
        if node is None:
            return self.response_404(
                message=(
                    "Factory status node was not found for device identifier "
                    f"'{_mes_device_id(mes_payload)}'"
                )
            )

        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=_node_to_payload(node))

    @expose("/apply_template/", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.apply_template"
        ),
        log_to_statsd=False,
    )
    def apply_template_layout(self) -> Response:
        """Apply the built-in factory status template.
        ---
        post:
          summary: Apply the built-in factory status template
          responses:
            200:
              description: Factory status template applied
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        payload = deepcopy(DEFAULT_FACTORY_STATUS_LAYOUT)
        layout = _get_layout_by_name(DEFAULT_LAYOUT_NAME)
        if layout is None:
            _create_layout_from_payload(payload)
        else:
            _update_layout(layout, payload)

        db.session.commit()  # pylint: disable=consider-using-transaction
        layout = _get_layout_by_name(DEFAULT_LAYOUT_NAME)
        if layout is None:
            return self.response(500, message="Factory status layout was not found")

        return self.response(200, result=_layout_to_payload(layout))

    @expose("/", methods=("PUT",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put_layout(self) -> Response:
        """Update the factory status layout.
        ---
        put:
          summary: Update the factory status layout
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FactoryStatusLayoutSchema'
          responses:
            200:
              description: Factory status layout updated
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        try:
            payload = factory_status_layout_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        payload["name"] = DEFAULT_LAYOUT_NAME
        layout = _get_layout_by_name(DEFAULT_LAYOUT_NAME)
        if layout is None:
            layout_id = _create_layout_from_payload(payload)
            layout = {
                "id": layout_id,
                "name": payload["name"],
                "width": payload["width"],
                "height": payload["height"],
                "changed_on": datetime.now(timezone(timedelta(hours=7))),
                "created_by_fk": getattr(getattr(g, "user", None), "id", None),
                "changed_by_fk": getattr(getattr(g, "user", None), "id", None),
            }
        else:
            _update_layout(layout, payload)

        db.session.commit()  # pylint: disable=consider-using-transaction
        layout = _get_layout_by_name(DEFAULT_LAYOUT_NAME)
        if layout is None:
            return self.response(500, message="Factory status layout was not found")

        return self.response(200, result=_layout_to_payload(layout))
