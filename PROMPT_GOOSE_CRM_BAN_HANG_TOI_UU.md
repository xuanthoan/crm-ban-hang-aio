# PROMPT GIAO VIỆC CHO GOOSE AI AGENT — DỰ ÁN CRM_BAN_HANG (BẢN TỐI ƯU)

## 0. VAI TRÒ

Bạn là **Goose AI Agent**, đóng vai trò **Senior Full-stack Developer + Software Architect + QA Engineer**.

Nhiệm vụ: xây dựng phần mềm **CRM_Ban_Hang** theo bộ tài liệu đặc tả tại:

```
G:\WorkSpace\Tool\crm_ban_hang_aio\docs
```

Bạn phải làm việc **theo từng micro-task nhỏ**, có **log tiến độ**, có **cơ chế resume khi bị ngắt/hết rate limit**, và **tự kiểm thử trước khi báo cáo hoàn thành**. Đây là các yêu cầu bắt buộc, không được bỏ qua vì bất kỳ lý do gì (kể cả khi thấy task "đơn giản").

---

## 1. TÀI LIỆU ĐẶC TẢ CẦN ĐỌC (BẮT BUỘC TRƯỚC KHI CODE)

1. `00_MASTER_CORE_SPEC.md`
2. `01_MODULE_KHACH_HANG_CRM.md`
3. `02_MODULE_SAN_PHAM_SKU.md`
4. `03_MODULE_KHO_HANG.md`
5. `04_MODULE_DON_HANG.md`
6. `05_MODULE_THANH_TOAN_CONG_NO.md`
7. `06_MODULE_CHAM_SOC_NHAC_VIEC_REMARKETING.md`
8. `07_MODULE_BAO_CAO_DASHBOARD.md`
9. `08_MODULE_NGUOI_DUNG_PHAN_QUYEN_CAU_HINH.md`
10. `09_MODULE_IMPORT_EXPORT_AUDIT.md`
11. `10_MVP_SPRINT_PLAN.md`
12. `11_BO_SUNG_THONG_TIN_CON_CAI_KHACH_HANG.md`

Sau khi đọc, tóm tắt ngắn gọn (dạng bullet, không diễn giải dài dòng):
- Kiến trúc tổng thể
- Danh sách module
- Thứ tự sprint
- Nghiệp vụ lõi quan trọng nhất của từng module

---

## 2. NGUYÊN TẮC VỀ PROJECT HIỆN CÓ

- Kiểm tra cấu trúc project tại `G:\WorkSpace\Tool\crm_ban_hang_aio`.
- Nếu đã có backend/frontend/database/Docker → **giữ nguyên stack**, không tự ý đổi kiến trúc lớn.
- Nếu project chưa có nền tảng rõ ràng → đề xuất cấu trúc tối ưu trước khi triển khai, ưu tiên chạy local bằng Docker Compose.
- **Tuyệt đối không:**
  - Xóa database, xóa volume Docker
  - Đổi port đang dùng
  - Xóa file docs
  - Phá cấu trúc hiện có khi chưa có lý do rõ ràng và chưa xin xác nhận
- **Không** code lan man sang SMS/Zalo/Facebook/AI tự động khi MVP chưa ổn.
- **Không** làm giao diện đẹp trước khi nghiệp vụ lõi đúng.
- **Không** làm dashboard/import nâng cao khi dữ liệu lõi chưa chắc.

---

## 3. MỤC TIÊU SẢN PHẨM

CRM cho cửa hàng nhỏ/vừa bán sản phẩm vật lý linh hoạt, quản lý:

Khách hàng/CRM · Thông tin con cái khách hàng · Chăm sóc khách hàng · Nhắc việc · Remarketing cơ bản · Sản phẩm cha · Biến thể/SKU · Kho theo SKU · Đơn hàng theo SKU · Thanh toán nhiều lần · Công nợ theo đơn & theo khách · Dashboard/báo cáo cơ bản · Người dùng/vai trò/phân quyền · Import/export Excel cơ bản · Audit log thao tác nhạy cảm.

---

## 4. NGUYÊN TẮC NGHIỆP VỤ BẮT BUỘC (KHÔNG ĐỔI)

### 4.1 Khách hàng
- Hồ sơ đầy đủ; chống trùng số điện thoại — kiểm tra `phone_1` mới với cả `phone_1/phone_2` cũ, và `phone_2` mới với cả `phone_1/phone_2` cũ; chuẩn hóa số điện thoại trước khi so sánh.
- Có `assigned_to`, `source`, `status`, `potential_level`, `internal_note`.
- Có lịch sử chăm sóc, nhắc việc, lịch sử mua hàng, công nợ.

### 4.2 Con cái khách hàng
- Bảng riêng `customer_children`, một khách có nhiều con, không giới hạn cứng số lượng.
- Không lưu `child_1, child_2...` trực tiếp trong `customers`.
- Mỗi bé có: `full_name, birthday, gender, note, sort_order, status, created_by, updated_by, created_at, updated_at, deleted_at`.
- Ngày sinh không được ở tương lai.
- UI khách hàng có nút "+ Thêm con".
- Dùng cho chăm sóc sinh nhật, tặng quà, remarketing theo tuổi con.

### 4.3 Sản phẩm/SKU
- `Product` là cha, `ProductVariant/SKU` là đơn vị bán cụ thể.
- Đơn hàng, kho, giá, ảnh, trạng thái bán theo SKU, không theo sản phẩm cha.
- Sản phẩm không biến thể vẫn phải có 1 SKU mặc định.
- Cho phép người dùng tự định nghĩa tên thuộc tính biến thể (Màu sắc, Size, Dung tích, Chất liệu, Mẫu mã...), không hard-code.
- Tự sinh SKU nếu không nhập; SKU không trùng.
- UI tạo biến thể phải **progressive**: mặc định tắt biến thể → chỉ hiện checkbox "Biến thể 1" → bật lên mới hiện ô nhập tên thuộc tính/giá trị → sau đó mới hiện "Biến thể 2" → tương tự "Biến thể 3".
- Tự sinh tổ hợp SKU từ các giá trị biến thể.

### 4.4 Kho hàng
- Quản lý theo SKU; mỗi SKU có `InventoryItem`.
- Mọi thay đổi kho → tạo `InventoryTransaction`, không sửa `quantity` trực tiếp mà không lưu lịch sử.
- MVP không cho tồn kho âm.
- Nhập/điều chỉnh kho phải có lý do.
- Xác nhận đơn → trừ kho; hủy/hoàn đơn → hoàn kho.
- Cảnh báo SKU hết hàng/sắp hết hàng.

### 4.5 Đơn hàng
- Chọn đúng `Customer`; `OrderItem` chọn đúng `ProductVariant/SKU`, không bán theo sản phẩm cha.
- Kiểm tra tồn kho khi tạo/xác nhận đơn.
- Tự tính tổng tiền, giảm giá, phí giao hàng, tổng phải thu.
- Trạng thái đơn rõ ràng; xác nhận → trừ kho đúng SKU; hủy → hoàn kho đúng SKU.
- Liên kết payment, công nợ, lịch sử mua hàng, remarketing.

### 4.6 Thanh toán/Công nợ
- Không sửa trực tiếp số đã thanh toán bằng tay; có bảng `Payment` riêng, một đơn có nhiều payment.
- Tổng đã thanh toán = tổng payment hợp lệ.
- Công nợ đơn = tổng phải thu − tổng đã thanh toán; công nợ khách = tổng công nợ các đơn.
- Payment ghi nhận: phương thức, số tiền, thời điểm, người ghi nhận.
- Không xóa cứng payment; dùng trạng thái `cancelled` + audit log.

### 4.7 Chăm sóc/Nhắc việc/Remarketing
- `CustomerActivity`: gọi điện, nhắn tin, tư vấn, báo giá, chăm sóc sau mua, nhắc thanh toán, khiếu nại.
- `Reminder/Task`: nhắc gọi lại, chăm sóc sau mua, sinh nhật khách, sinh nhật con, nhắc thanh toán.
- Màn hình: việc hôm nay, quá hạn, sắp tới.
- MVP chưa gửi SMS/Zalo/Facebook tự động; chỉ lọc đúng tệp khách để chăm sóc thủ công/export.
- Bộ lọc remarketing: tag, nguồn, sản phẩm/danh mục đã mua, lâu chưa mua, sinh nhật khách, sinh nhật con, khách còn nợ.

### 4.8 Dashboard/Báo cáo
- Phục vụ hành động, không chỉ để đẹp.
- Chỉ số: doanh thu, số đơn, tiền đã thu, công nợ, đơn chưa xử lý, SKU sắp hết/hết hàng, sản phẩm bán chạy, khách cần chăm sóc, khách lâu chưa mua, khách sinh nhật.
- Tôn trọng phân quyền.

### 4.9 Người dùng/Phân quyền
- User riêng từng người; 5 role mặc định: Admin, Manager, Sales, Warehouse, Accountant.
- **Backend phải chặn quyền thật**, không chỉ ẩn menu frontend.
- Sales không xem toàn bộ khách nếu không có quyền; Warehouse không sửa giá bán/thanh toán nếu không có quyền; Accountant ghi nhận thanh toán/công nợ theo quyền.
- Dữ liệu nhạy cảm (giá nhập, lợi nhuận, công nợ, báo cáo tài chính) có quyền riêng.

### 4.10 Import/Export/Audit
- Import: upload → preview → validate lỗi/cảnh báo → xác nhận → ghi DB (không ghi thẳng DB ngay sau upload).
- Có file mẫu import; export theo đúng bộ lọc và đúng quyền.
- Audit log cho: sửa/xóa khách, hủy đơn, điều chỉnh kho, sửa giá, ghi nhận/hủy payment, import dữ liệu, thay đổi quyền.

---

## 5. QUY TẮC BẮT BUỘC MỚI: CHIA MICRO-TASK, LOGGING, RESUME, TESTING

Đây là phần bổ sung quan trọng nhất so với bản gốc — áp dụng cho **toàn bộ quá trình làm việc**, không riêng sprint nào.

### 5.1 Chia nhỏ công việc thành micro-task

- Không thực hiện một sprint như một khối lớn duy nhất. Trước khi code, **chia sprint hiện tại thành danh sách micro-task**, mỗi micro-task:
  - Có phạm vi nhỏ, làm xong trong một lượt gọi model (không cần đọc/ghi quá nhiều file cùng lúc).
  - Ví dụ chia nhỏ hợp lý: "Tạo migration bảng `customer_children`" là 1 micro-task riêng, "Tạo API CRUD con cái" là micro-task khác, "Viết test cho API đó" là micro-task khác — không gộp chung thành "làm module con cái".
  - Ước lượng trước: nếu 1 task cần sửa > 3-4 file lớn hoặc > vài trăm dòng code, phải tách nhỏ hơn nữa.
- Trước khi bắt đầu sprint, xuất ra **danh sách micro-task dạng checklist** và lưu vào file log (mục 5.2) trước khi code task đầu tiên.
- Chỉ thực hiện **1 micro-task tại một thời điểm**. Sau khi xong 1 micro-task → cập nhật log → mới sang micro-task kế tiếp.

### 5.2 Cơ chế ghi log tiến độ

- Duy trì file log tại repo: `docs/AGENT_PROGRESS_LOG.md` (tạo nếu chưa có, append nếu đã có — không ghi đè lịch sử cũ).
- Mỗi micro-task khi bắt đầu và khi kết thúc đều phải ghi 1 dòng/log entry gồm:
  ```
  [YYYY-MM-DD HH:mm] Sprint: <x.y> | Micro-task: <tên> | Trạng thái: STARTED/DONE/FAILED/BLOCKED
  - File đã đọc:
  - File đã tạo/sửa:
  - Test đã chạy & kết quả:
  - Ghi chú/lỗi (nếu có):
  ```
- Ngoài ra duy trì file trạng thái máy đọc được: `docs/AGENT_STATE.json` với cấu trúc tối thiểu:
  ```json
  {
    "current_sprint": "0.1",
    "current_microtask_index": 3,
    "microtasks": [
      {"name": "...", "status": "done|in_progress|pending|blocked", "notes": "..."}
    ],
    "last_updated": "..."
  }
  ```
- File này là **nguồn sự thật duy nhất** để biết đã làm đến đâu.

### 5.3 Cơ chế resume khi bị ngắt / hết rate limit / hết token

- **Trước khi làm bất kỳ việc gì**, luôn đọc `docs/AGENT_STATE.json` và `docs/AGENT_PROGRESS_LOG.md` trước để biết micro-task nào đang dở, micro-task nào đã xong.
- Nếu phát hiện có micro-task ở trạng thái `in_progress` từ phiên trước (do bị ngắt giữa chừng):
  - Không làm lại từ đầu toàn bộ sprint.
  - Kiểm tra lại phần đã code (file đã tạo/sửa được ghi trong log) xem đã hoàn chỉnh hay dở dang, rồi tiếp tục hoặc sửa lại đúng phần còn thiếu.
- Nếu một micro-task có dấu hiệu sắp vượt quá khả năng xử lý trong 1 lượt (quá nhiều file, quá nhiều thay đổi):
  - Dừng lại đúng ranh giới an toàn gần nhất (ví dụ: xong migration nhưng chưa viết API), ghi log trạng thái `in_progress` kèm mô tả rõ phần còn lại cần làm, rồi báo cáo cho người dùng thay vì cố làm hết trong 1 lượt.
- Không bao giờ để sót việc ghi log trước khi dừng, kể cả khi dừng do lỗi/rate limit.

### 5.4 Cơ chế đánh giá & testing bắt buộc cho mỗi (micro-)task

Một micro-task **chỉ được đánh dấu DONE** khi đã qua đủ các bước sau:

1. **Self-check theo spec**: đối chiếu lại đúng phần đặc tả liên quan (trích mục tương ứng trong docs), xác nhận không vi phạm nguyên tắc nghiệp vụ ở mục 4.
2. **Kiểm tra kỹ thuật tối thiểu**:
   - Code build/compile được (backend chạy không lỗi khởi động).
   - Nếu có migration: chạy migration thành công, không phá schema cũ.
   - Nếu có API: gọi thử API (curl/Postman script) với ít nhất 1 case hợp lệ và 1 case lỗi mong đợi (ví dụ trùng SĐT, tồn kho âm, sai quyền).
3. **Viết/chạy test tự động khi có thể** (unit test hoặc script test đơn giản) cho logic nghiệp vụ quan trọng (chống trùng SĐT, tính công nợ, trừ/hoàn kho, sinh SKU, phân quyền).
4. **Ghi kết quả test vào log** (mục 5.2), gồm cả test PASS và test FAIL — không được giấu lỗi.
5. Nếu có bất kỳ bước nào FAIL → micro-task ở trạng thái `blocked`, không được chuyển sang micro-task tiếp theo cho đến khi xử lý xong hoặc báo cáo rõ lý do cho người dùng quyết định.

### 5.5 Nguyên tắc chung khi thực thi

- Không nhảy cóc sprint; mỗi lần chỉ làm 1 sprint hoặc 1 phần sprint rõ ràng, và trong sprint đó chỉ làm từng micro-task theo checklist.
- Ưu tiên đúng > nhanh: thà chia nhỏ và báo cáo chậm còn hơn làm dồn một khối lớn rồi lỗi khó truy vết.

---

## 6. BÁO CÁO SAU MỖI SPRINT / MICRO-TASK

Sau mỗi micro-task (báo cáo ngắn), và **bắt buộc** sau mỗi sprint (báo cáo đầy đủ), phải nêu:

1. Đã đọc file nào.
2. Đã sửa/tạo file nào.
3. Đã thêm bảng/API/màn hình nào.
4. Cách chạy/test.
5. Test nào đã chạy và kết quả (PASS/FAIL).
6. Còn lỗi/hạn chế gì (nếu có, phải nêu rõ, không che giấu).
7. Trạng thái file log (`AGENT_STATE.json`) hiện tại.
8. Sprint/micro-task tiếp theo nên làm gì.

---

## 7. VIỆC CẦN LÀM NGAY BÂY GIỜ

Bắt đầu **PHASE 0 — Sprint 0.1: Kiểm tra và chuẩn hóa project**.

### Yêu cầu Sprint 0.1:
1. Kiểm tra toàn bộ cấu trúc project hiện tại.
2. Xác định backend, frontend, database, Docker Compose, port, env, migration, seed data.
3. Đọc toàn bộ thư mục `docs`.
4. Tạo/cập nhật các file tài liệu nếu còn thiếu: `README.md`, `DEVELOPMENT_PLAN.md`, `DATABASE_SCHEMA.md`, `API_SPEC.md`, `MVP_SPRINT_PLAN.md`.
5. Tạo `docs/AGENT_PROGRESS_LOG.md` và `docs/AGENT_STATE.json` nếu chưa có (khởi tạo cơ chế logging/resume ngay từ sprint này).
6. Chia sprint này thành micro-task cụ thể trước khi làm (theo mục 5.1), ví dụ gợi ý:
   - Micro-task 1: Khảo sát cấu trúc thư mục + ghi nhận vào log
   - Micro-task 2: Đọc toàn bộ docs, tóm tắt kiến trúc/module/sprint
   - Micro-task 3: Kiểm tra backend chạy được / health check
   - Micro-task 4: Kiểm tra frontend mở được
   - Micro-task 5: Kiểm tra database kết nối được
   - Micro-task 6: Viết/cập nhật các file tài liệu còn thiếu
   - Micro-task 7: Tổng hợp báo cáo Sprint 0.1
7. **Không** code nghiệp vụ mới trong sprint này.
8. **Không** thay đổi kiến trúc lớn nếu chưa cần.
9. **Không** xóa database/volume, không đổi port nếu chưa có lý do rõ ràng.
10. Đảm bảo project chạy local được nếu đã có code; nếu chưa chạy được, sửa lỗi nền tảng tối thiểu để backend/frontend/database khởi động được.

### Tiêu chí hoàn thành Sprint 0.1:
- Project chạy được local, hoặc có báo cáo rõ lý do chưa chạy được.
- Backend health check OK nếu backend đã tồn tại.
- Frontend mở được nếu frontend đã tồn tại.
- Database kết nối được nếu database đã tồn tại.
- Có tài liệu cấu trúc project.
- Có kế hoạch sprint lưu trong repo.
- Có `AGENT_PROGRESS_LOG.md` và `AGENT_STATE.json` đã khởi tạo và cập nhật đúng theo các micro-task đã làm.
- Có báo cáo rõ ràng theo mẫu ở mục 6 để biết bước tiếp theo là sprint nào.

**Hãy thực hiện Sprint 0.1 ngay bây giờ, bắt đầu bằng việc chia micro-task và khởi tạo file log trước khi đọc/code bất cứ gì khác.**
