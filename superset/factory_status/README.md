# Factory Status

Bản đồ nhà xưởng real-time (kiểu SCADA): các ô thiết bị/khu vực/label được đặt
trên một canvas (x/y/width/height), mỗi ô có trạng thái vận hành, chế độ điều
khiển, recipe, lỗi/alarm hiện tại, và số liệu sản xuất trong ngày. Dữ liệu vào
từ 3 nguồn: sửa tay trên UI, webhook công khai từ MES/EAP, và job nền định kỳ
kéo dữ liệu từ Oracle.

## Thành phần

Backend: `superset/factory_status/`
- `api.py` — `FactoryStatusRestApi`, các endpoint chính + webhook công khai
- `task_configs_api.py` — `FactoryStatusTaskConfigsApi`, quản lý job SQL nền
- `tasks.py` — 2 Celery task đồng bộ dữ liệu
- `schemas.py` — Marshmallow schema cho request/response
- `views.py` — đăng ký menu/route AppBuilder

Frontend:
- `superset-frontend/src/pages/FactoryStatus/index.tsx` — bản đồ chính, sửa/kéo-thả
- `superset-frontend/src/pages/FactoryStatusGroups/index.tsx` — view tổng hợp theo nhóm
- `superset-frontend/src/pages/FactoryStatusTaskConfigs/index.tsx` — admin config SQL

Route: `/factory-status/`, `/factory-status/groups/`,
`/factory-status-settings/task-configs/` (khai báo ở
`superset-frontend/src/views/routes.tsx`, menu ở
`superset-frontend/src/features/home/Menu.tsx`).

## API (`/api/v1/factory_status/...`)

| Method | Path | Auth | Việc gì |
|---|---|---|---|
| GET | `/` | login | Lấy layout (nodes + alarms) |
| PUT | `/` | login + write | Lưu **toàn bộ** layout (full-replace, không phải patch) |
| POST | `/apply_template/` | login + write | Reset về template mặc định (~87 node hard-code trong `api.py`) |
| POST | `/sync_status/` | login + write | Kéo status live từ Oracle `MRASRESDEF`, ghi đè node |
| POST | `/public/eapmes/node/` | **không auth** | MES đẩy status/mode/recipe/alarm vào 1 node |
| POST | `/public/eapmes/node_quantity/` | không auth | Trả tổng qty/OK/NG trong ngày (query Oracle `CSUMWIPOPR`) |
| POST | `/public/eapmes/node_down_time/` | không auth | Trả thời gian downtime (query Oracle `CSUMDWNDAT`) |
| POST | `/public/eapmes/alarm_report_send/` | không auth | Set alarmId/alarmDesc cho node |
| POST | `/public/eapmes/recipe/` | không auth | Set recipe cho node |
| POST | `/public/eapmes/cim_controlmode/` | không auth | Set control mode (OR/OL/OF), ghi log vào `factory_status_cim_controlmode_history` |
| POST | `/public/eapmes/change_resource_state/` | không auth | Set trạng thái/alarm cho node |
| POST | `/public/eapmes/non_operation/` | không auth | Set down_code (tự tra `down_desc` từ `factory_status_down_codes`) |
| GET | `/task_configs/` | admin | Danh sách job SQL nền |
| PUT | `/task_configs/<id>` | admin | Sửa `sql_query` / `interval_min` / `is_active` (`name`, `task_type` bất biến) |

> Chi tiết đầy đủ về nhóm `/public/eapmes/*` (mapping field, quy tắc chuẩn
> hoá status/mode, ví dụ request/response từng endpoint) xem
> [EXTERNAL_UPDATE_API.md](./EXTERNAL_UPDATE_API.md).

Response layout (rút gọn):
```json
{
  "name": "default", "width": 0, "height": 0,
  "nodes": [{ "id": "", "deviceId": "", "deviceCode": "", "label": "",
              "type": "equipment|area|label", "x": 0, "y": 0, "width": 0, "height": 0,
              "status": "run|idle|down|power_off|disconnection",
              "mode": "remote|local|offline",
              "details": { "RES_ID": "", "RECIPE": "", "DOWN_CODE": "", "ALARM_ID": "" } }],
  "alarms": [{ "groupName": "", "deviceId": "", "eqm": "", "alarmCode": "", "alarmCount": 0 }],
  "updated_at": ""
}
```

## Frontend gọi API thế nào

- **FactoryStatus** (trang chính): `GET /` khi mount + poll mỗi **5 giây**
  (dừng poll khi đang edit/drag/resize/save); `PUT /` khi bấm Save; `POST
  /sync_status/` khi bấm nút Sync (admin); click vào 1 thiết bị → gọi
  `node_quantity/` + `node_down_time/`, poll lại mỗi 5 phút khi popup đang mở.
- **FactoryStatusGroups**: chỉ `GET /` mỗi 5s, tự tính nhóm ở **client** bằng
  cách xét node `type=area` nào bao node `type=equipment` theo tọa độ —
  **không có khái niệm group trong DB**.
- **FactoryStatusTaskConfigs**: `GET /task_configs/` khi mount, `PUT
  /task_configs/<id>` khi lưu.

## Data — bảng & quan hệ

Toàn bộ dùng SQL thô qua `db.session.execute(text(...))`, **không có model
ORM** trong `superset/models/`.

- `factory_status_layouts` — 1 dòng = 1 layout/factory, hiện chỉ có
  `name = "default"`.
- `factory_status_nodes` — thiết bị/khu vực/label. FK `layout_id`, unique
  `(layout_id, node_id)`.
- `factory_status_alarms` — top alarm theo thiết bị. FK `layout_id`, unique
  `(layout_id, group_name, eqm, alarm_code)`.
- `factory_status_down_codes` — bảng tra cứu mã lỗi → mô tả (global, seed
  sẵn 12 dòng).
- `factory_status_cim_controlmode_history` — log lịch sử đổi control mode
  (append-only, không FK).
- `factory_status_task_configs` — cấu hình job SQL đồng bộ nền: `name`,
  `task_type` (`alarm_summary` | `node_delay_time`), `sql_query`,
  `interval_min`, `layout_name`, `is_active`, `last_run_at`,
  `last_run_result`.

Thiết bị được match theo `device_id` **hoặc** `device_code` **hoặc**
`res_id` (bất kỳ cái nào khớp), luôn trong phạm vi 1 `layout_id`
(`_get_node_by_device_id` trong `api.py`, `_sync_node_status_data` trong
`tasks.py`).

## Background task (Celery)

Đăng ký trong `superset/config.py` (`CELERYBEAT_SCHEDULE`) và `include` list
(`superset.factory_status.tasks`).

- **`factory_status.sync_node_status`** — chạy mỗi 2 phút
  (`crontab(minute="*/2")`). Query Oracle `MRASRESDEF` (hard-code `WHERE
  FACTORY = 'DV01'`), update `factory_status_nodes`. Là bản chạy nền song
  sinh của nút "Sync Status" trên UI.
- **`factory_status.run_task_configs`** — chạy mỗi phút
  (`crontab(minute="*")`). Đọc `factory_status_task_configs` (những dòng
  `is_active = true` và đã đến hạn theo `interval_min` tính từ
  `last_run_at`), kết nối database Superset tên `"Oracle_Product"`, chạy
  `sql_query` đã cấu hình, rồi tùy `task_type`:
  - `alarm_summary` → upsert/xóa `factory_status_alarms` theo
    `(group_name, eqm, alarm_code)`.
  - `node_delay_time` → xóa hết `delay_time` rồi set lại theo kết quả query.
  Sau mỗi lần chạy ghi `last_run_at` + `last_run_result` (JSON) lại vào
  chính dòng config.

## Cách thêm thiết bị mới

**Qua UI (khuyến nghị):**
1. Vào `/factory-status/`, bấm **Node** → tạo node stub (`EQM#N`, `status:
   run`, `mode: remote`).
2. Sửa Name / Device code / Type / Status / Mode / vị trí trên panel.
3. Bấm **Save** → gửi `PUT /` với **toàn bộ** danh sách node hiện có (kể cả
   node mới).

> ⚠️ Backend diff theo `node_id`: node lạ → `INSERT`, node cũ **bị thiếu**
> trong payload → **bị xóa**. `PUT /` là full-replace, không phải patch —
> luôn `GET /` trước rồi mới sửa/thêm vào mảng `nodes` để không mất dữ liệu.

**Qua API/script (thêm hàng loạt):**
1. `GET /api/v1/factory_status/` lấy layout hiện tại.
2. Append object mới vào `nodes[]` theo `FactoryStatusNodeSchema`:
   - Bắt buộc: `id` (string duy nhất), `type` (`equipment`/`area`/`label`),
     `x`, `y`, `width` (≥20), `height` (≥20), `status`, `mode`.
   - Nên có: `deviceId`, `deviceCode`, `details` (dict tự do, quy ước gồm
     `RES_ID`, `STATUS`, `RECIPE`, ...).
3. `PUT /api/v1/factory_status/` lại cả layout đã sửa.

**Để nhận update live từ MES:** `device_id` / `device_code` / `res_id` đặt
trong Superset phải **trùng khớp tuyệt đối** với `RES_ID` / `EQP_ID` mà
MES/Oracle dùng cho thiết bị đó ở phía nhà máy.

## Triển khai nhiều nhà máy

**Đã sẵn sàng ở tầng DB (không cần migration):**
- `factory_status_layouts.name` vốn đã là chuỗi tự do, unique → 1 layout =
  1 factory, chỉ cần thêm dòng layout mới là có ngay 1 factory mới.
- `factory_status_nodes` / `factory_status_alarms` đã scope theo `layout_id`
  FK sẵn.
- `factory_status_task_configs.layout_name` đã tồn tại sẵn để 1 job chỉ
  định layout đích.
- `device_id`/`device_code`/`res_id` chỉ cần unique trong phạm vi
  `layout_id` → nhiều factory có thể trùng mã thiết bị mà không đụng nhau.

**Cần sửa code (phần thực sự còn thiếu):**
1. `DEFAULT_LAYOUT_NAME = "default"` hard-code ở cả `api.py` và `tasks.py`
   — mọi endpoint đều resolve cứng về layout này, **không có param
   `layout_name`/`factory_id`** nào trong URL. Cần thêm segment (vd
   `/api/v1/factory_status/<layout_name>/`) và truyền xuyên suốt thay vì
   dùng constant.
2. Các câu SQL Oracle (`NODE_QUANTITY_SQL`, `NODE_DOWN_TIME_SQL`,
   `NODE_STATUS_SYNC_SQL` trong `api.py`, và bản trùng lặp trong
   `tasks.py::sync_node_status`) đều hard-code `WHERE FACTORY = 'DV01'` —
   cần tham số hóa theo factory thay vì literal trong SQL.
3. Các dòng `sql_query` đã seed sẵn trong `factory_status_task_configs`
   (từ migration) cũng hard-code `FACTORY = 'DV01'` trong text SQL — mỗi
   factory mới cần thêm dòng config riêng với `layout_name` tương ứng và
   SQL viết lại cho đúng mã factory đó.
4. Frontend: cả 3 trang gọi `SupersetClient` tới
   `/api/v1/factory_status/` không có tham số layout/factory; route
   (`views/routes.tsx`) cố định `/factory-status/` không có
   `:factoryId`; menu (`Menu.tsx`) chỉ có 1 link tĩnh. Cần thêm route
   param, bộ chọn factory trên UI, và sửa các lệnh gọi API để truyền
   layout tương ứng.

**Tóm lại:** data model đã hỗ trợ N factory (N dòng layout) mà không cần
đổi schema — cái thiếu hoàn toàn nằm ở tầng code: (1) API cần selector
layout/factory thay vì hằng số cứng, (2) SQL Oracle cần tham số hóa theo
factory, (3) frontend cần route + UI chọn factory.
