# Factory Status — API cập nhật trạng thái thiết bị từ bên ngoài (MES/EAP)

Tài liệu này mô tả chi tiết nhóm endpoint **công khai, không cần đăng nhập**
(`/api/v1/factory_status/public/eapmes/*`) mà hệ thống MES/EAP của nhà máy
gọi vào để cập nhật trạng thái, mode, recipe, alarm, down-code của từng
thiết bị trên bản đồ Factory Status. Tổng quan kiến trúc xem thêm ở
[README.md](./README.md).

Toàn bộ endpoint trong nhóm này định nghĩa ở
`superset/factory_status/api.py` (class `FactoryStatusRestApi`), có
`allow_browser_login = True` và `csrf_exempt = True` ở cấp class — **không
cần token/cookie đăng nhập, không cần CSRF token**. Vì public hoàn toàn nên
KHÔNG được lộ URL này ra ngoài mạng nội bộ nhà máy.

## Cách một thiết bị được xác định (device matching)

Mọi endpoint update đều tìm node theo 1 trong 3 cột, khớp cột nào cũng
được, trong phạm vi layout `"default"`:

```sql
WHERE device_id = :id OR device_code = :id OR res_id = :id
```

Định danh gửi lên được lấy theo thứ tự ưu tiên đầu tiên khác rỗng
(hàm `_public_node_identifier` / `_mes_device_id` trong `api.py`):

- Với payload kiểu "public update" (`deviceId`/`resId`/...): `deviceId` →
  `resId` → `deviceCode` → `RES_ID` → `SEND_RES_ID` → `DEVICE` → `Device`.
- Với payload kiểu "MES" (`RES_ID` bắt buộc): `RES_ID` → `SEND_RES_ID` →
  `DEVICE` → `Device` → `deviceId`.

**⚠️ Nếu không tìm thấy node khớp → `404`.** Thiết bị phải được tạo trước
(qua UI hoặc `PUT /api/v1/factory_status/`, xem README) với `deviceCode`
hoặc `details.RES_ID` trùng đúng mã mà MES sẽ gửi lên, thì các webhook dưới
đây mới cập nhật được.

## Chuẩn hoá giá trị (normalize)

- **status** — giá trị gửi lên được lowercase rồi map qua bảng mã số:
  ```
  "1" → idle   "2" → run   "3" → down   "4" → power_off   "5" → disconnection
  ```
  Nếu sau khi map vẫn không thuộc tập hợp lệ
  `{run, idle, down, power_off, disconnection}` → **mặc định `"down"`**.
- **mode** — map qua bảng: `OF → offline`, `OL → local`, `OR → remote`
  (không phân biệt hoa/thường ở input, so khớp bằng chữ hoa). Nếu không
  thuộc `{remote, local, offline}` sau khi map → **mặc định `"offline"`**.
- **statusText** — nếu không gửi kèm, tự sinh từ `status` (vd `power_off` →
  `"POWER OFF"`).
- **downDate / CLIENT_TIME** — nếu là chuỗi số ≥14 ký tự (`yyyyMMddHHmmss`)
  sẽ tự format lại thành `"yyyy-MM-dd HH:mm:ss"`, ngược lại giữ nguyên.

## Danh sách endpoint

### 1. `POST /api/v1/factory_status/public/eapmes/node/`
Cập nhật tổng quát 1 node (status/mode/recipe/alarm/down-code cùng lúc).

Schema: `FactoryStatusNodePublicUpdateSchema` — mọi field đều optional trừ
việc phải có ít nhất 1 định danh thiết bị. Có 2 cách đặt tên (camelCase và
UPPER_SNAKE) cho nhiều field, dùng cái nào cũng được:

| Field | Field (viết tắt khác) | Cột DB cập nhật | Ghi chú |
|---|---|---|---|
| `deviceId` / `resId` / `deviceCode` / `RES_ID` / `SEND_RES_ID` / `DEVICE` / `Device` | — | *(dùng để tìm node, không ghi)* | ít nhất 1 cái phải có |
| `status` | `STATUS` | `status` (+`status_text` nếu chưa gửi `statusText`) | qua bước chuẩn hoá status ở trên |
| `mode` | — | `mode` | qua bước chuẩn hoá mode ở trên |
| `statusText` | — | `status_text` | text hiển thị tuỳ ý, không chuẩn hoá |
| `resId` | `RES_ID` | `res_id` | |
| `recipe` | — | `recipe` | |
| `downCode` | `DOWN_CODE` | `down_code` | |
| `downDesc` | `DOWN_DESC` | `down_desc` | |
| `alarmId` | `ALARM_ID` | `alarm_id` | |
| `alarmDesc` | `ALARM_DESC` | `alarm_desc` | |
| `downDate` | `DOWN_DATE` | `down_date` | qua bước format datetime ở trên |

Chỉ field nào có mặt trong JSON gửi lên mới được `UPDATE` — field vắng mặt
giữ nguyên giá trị cũ (không bị xoá về rỗng).

Request mẫu:
```json
POST /api/v1/factory_status/public/eapmes/node/
{
  "RES_ID": "AGB-4",
  "status": "down",
  "mode": "remote",
  "downCode": "70023",
  "alarmId": "70023",
  "alarmDesc": "Vacuum sensor error"
}
```
Response `200`:
```json
{ "result": { "id": "agb-4", "deviceId": "AGB-4", "status": "down", "mode": "remote", "...": "..." } }
```
Response `400`: thiếu định danh thiết bị hoặc field sai kiểu/không hợp lệ.
Response `404`: không tìm thấy node khớp `device_id`/`device_code`/`res_id`.

### 2. `POST /api/v1/factory_status/public/eapmes/node_quantity/`
Không cập nhật gì — **đọc** trực tiếp từ Oracle (database Superset tên
`"Oracle_Product"`, bảng `CSUMWIPOPR`, lọc theo ngày hiện tại
`TRUNC(SYSDATE)`), trả tổng sản lượng trong ngày của thiết bị.

Schema request: `FactoryStatusNodeQuantityRequestSchema` — 1 trong
`deviceId` / `resId` / `RES_ID` / `SEND_RES_ID` / `deviceCode`.

```json
POST /api/v1/factory_status/public/eapmes/node_quantity/
{ "RES_ID": "AGB-4" }
```
Response `200`:
```json
{ "result": { "resId": "AGB-4", "workDate": "20260821", "totalQty": 1200, "totalOk": 1185, "totalNg": 15 } }
```
Nếu không có dòng nào trong Oracle khớp ngày+RES_ID: trả về `totalQty:
0, totalOk: 0, totalNg: 0` (không phải lỗi).

### 3. `POST /api/v1/factory_status/public/eapmes/node_down_time/`
Tương tự #2 nhưng query bảng `CSUMDWNDAT` (lọc cứng `FACTORY = 'DV01'` +
ngày hiện tại), trả tổng thời gian downtime.

```json
POST /api/v1/factory_status/public/eapmes/node_down_time/
{ "RES_ID": "AGB-4" }
```
Response `200`:
```json
{ "result": { "resId": "AGB-4", "downTime": 45 } }
```

### 4. `POST /api/v1/factory_status/public/eapmes/alarm_report_send/`
Cập nhật riêng `alarm_id`/`alarm_desc` (dùng cho sự kiện "AlarmReportSend"
của MES).

Schema: `FactoryStatusMesAlarmReportSchema`.

| Field payload | Cột DB | |
|---|---|---|
| `RES_ID` / `SEND_RES_ID` / `DEVICE` / `Device` / `deviceId` | *(định danh)* | ưu tiên `RES_ID` trước |
| `ALID` | `alarm_id` | |
| `ALTX` | `alarm_desc` | |

```json
POST /api/v1/factory_status/public/eapmes/alarm_report_send/
{ "RES_ID": "USC-3", "ALCD": "AL01", "ALID": "AL01", "ALTX": "Door open" }
```
(`ALCD` được nhận nhưng hiện **không** ghi vào cột nào.)

### 5. `POST /api/v1/factory_status/public/eapmes/recipe/`
Cập nhật riêng `recipe`.

Schema: `FactoryStatusMesRecipeSchema` (kế thừa base MES schema, `RES_ID`
bắt buộc).

```json
POST /api/v1/factory_status/public/eapmes/recipe/
{ "RES_ID": "ISM-1", "RECIPE": "RCP-A203" }
```

### 6. `POST /api/v1/factory_status/public/eapmes/cim_controlmode/`
Cập nhật `mode`, và nếu chuyển sang `OF` thì đồng thời set `status =
power_off`. **Đồng thời ghi 1 dòng log** vào bảng
`factory_status_cim_controlmode_history` (không FK tới node/layout, chỉ
lưu `res_id`, `cim_controlmode`, `status`, `created_on` theo giờ UTC+7).

Schema: `FactoryStatusMesControlModeSchema`. `RES_ID` bắt buộc,
`CIM_CONTROLMODE` bắt buộc, chỉ nhận `OR` / `OL` / `OF`.

```json
POST /api/v1/factory_status/public/eapmes/cim_controlmode/
{ "RES_ID": "AGB-1", "CIM_CONTROLMODE": "OF" }
```
→ node `AGB-1`: `mode = "offline"`, `status = "power_off"`.

### 7. `POST /api/v1/factory_status/public/eapmes/change_resource_state/`
Cập nhật `status` (và `status_text`) dựa trên state code/group/acronym của
MES — dùng logic suy luận theo từ khoá, **không phải map 1-1 đơn giản**
(hàm `_resource_state_status` trong `api.py`):

1. Ghép `CURR_STATE_GROUP` + `CURR_STATE_ACRO` thành 1 chuỗi, viết hoa.
2. Nếu chuỗi chứa `DISCONNECTION`/`DISCONNECT`/`COMM` → `disconnection`.
3. Ngược lại chứa `POWER`/`OFF` → `power_off`.
4. Ngược lại chứa `DOWN`/`ALARM`/`STOP`/`NON` → `down`.
5. Ngược lại chứa `IDLE`/`STANDBY`/`WAIT` → `idle`.
6. Ngược lại chứa `RUN`/`PRODUCT`/`PROCESS` → `run`.
7. Nếu cả `CURR_STATE_GROUP` và `CURR_STATE_ACRO` đều rỗng → fallback tra
   `CURR_STATE_CODE` qua bảng mã số (`1→idle, 2→run, 3→down, 4→power_off,
   5→disconnection`), mặc định `run` nếu không khớp.
8. Chỉ update `status` khi request có ít nhất 1 trong 3 field
   `CURR_STATE_CODE`/`CURR_STATE_GROUP`/`CURR_STATE_ACRO` — nếu không gửi
   field nào trong 3 field này thì **không đổi status**, chỉ tìm node để
   xác nhận tồn tại.

Schema: `FactoryStatusMesResourceStateSchema`. `RES_ID` bắt buộc.

```json
POST /api/v1/factory_status/public/eapmes/change_resource_state/
{ "RES_ID": "ETCHER-1", "CURR_STATE_GROUP": "DOWN", "CURR_STATE_ACRO": "ALARM", "ALID": "AL77", "ALCD": "77", "ALTX": "Chamber alarm" }
```
→ `status = "down"`. (`ALID`/`ALCD`/`ALTX` được nhận vào schema nhưng
**không** được ghi vào node trong endpoint này — dùng
`alarm_report_send/` nếu muốn cập nhật alarm.)

### 8. `POST /api/v1/factory_status/public/eapmes/non_operation/`
Cập nhật down-code khi thiết bị dừng (sự kiện "Non Operation").

Schema: `FactoryStatusMesNonOperationSchema`. `RES_ID` bắt buộc.

| Field payload | Cột DB | Ghi chú |
|---|---|---|
| `RES_ID` | `res_id` | ghi lại chính định danh đã tìm thấy |
| `DOWN_CODE` | `down_code` | |
| — | `down_desc` | **tự động tra** từ bảng `factory_status_down_codes` theo `DOWN_CODE` gửi lên, không cần gửi `DOWN_DESC` |
| `CLIENT_TIME` | `down_date` | qua bước format datetime |

```json
POST /api/v1/factory_status/public/eapmes/non_operation/
{ "RES_ID": "PFL-1", "DOWN_CODE": "D1101", "CLIENT_TIME": "20260821143000", "COMMENTS": "Manual stop by operator" }
```
→ `down_code = "D1101"`, `down_desc` tự tra ra `"Breakdown(Manual)"` (xem
danh sách mã trong `factory_status_down_codes`), `down_date = "2026-08-21
14:30:00"`. (`COMMENTS` được nhận vào schema nhưng hiện **không** ghi vào
cột nào.)

Response `404` của riêng endpoint này có message rõ ràng hơn các endpoint
khác:
```json
{ "message": "Factory status node was not found for device identifier 'PFL-99'" }
```

## Bảng tra mã lỗi (`factory_status_down_codes`)

Dùng để tự động điền `down_desc` khi endpoint #8 nhận `DOWN_CODE`. Đây là
bảng global (không theo layout), seed sẵn qua migration — muốn thêm mã lỗi
mới thì `INSERT INTO factory_status_down_codes (down_code, down_desc)
VALUES (...)`.

## Lưu ý khi tích hợp

- Tất cả các endpoint `/public/eapmes/*` đều **POST + JSON body**
  (`Content-Type: application/json`), thiếu body hoặc không phải JSON hợp
  lệ sẽ bị `400` (decorator `@requires_json`).
- Không có endpoint nào trong nhóm này tạo mới node — thiết bị phải tồn
  tại sẵn trong layout `"default"` trước khi MES gửi update, nếu không sẽ
  luôn nhận `404`.
- Đây là **full public, không rate-limit, không xác thực** — nên đặt sau
  firewall/VPN nội bộ nhà máy, không public ra Internet.
- Muốn kiểm tra kết quả sau khi bắn webhook: `GET
  /api/v1/factory_status/` (cần đăng nhập) sẽ trả lại toàn bộ layout kèm
  giá trị mới nhất của node vừa cập nhật.
