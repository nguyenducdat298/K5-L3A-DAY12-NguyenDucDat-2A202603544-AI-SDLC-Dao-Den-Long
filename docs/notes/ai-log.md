# Nhật ký sử dụng AI & Quản lý Token (AI Usage Log)

## 1. Phase 1 — PRD-0 & Test Contract v1.0
- **Cách điều phối AI & Harness:** Dùng subagent `prd-analyst` phân tích PRD-0 trước khi code; thiết lập `AGENTS.md`, skill `verify-phase`, và `.githooks/pre-commit`.
- **Tổng token Phase 1:** ~45.800 tokens (~$0.22 USD).

---

## 2. Phase 2 — TICKET-02 ("Ba hòn đảo") & Test Contract v1.1

### 2.1. Điều phối AI & Cập nhật Harness
- **Cập nhật `AGENTS.md` & `.agents/skills/verify-phase/SKILL.md`:** Bổ sung quy trình 12 bước xử lý trong 1 tick, quy ước góc bản đồ cực (`+X` ngược chiều kim đồng hồ), kiểm tra hiệu năng 21.600 tick `≤ 30s` và 3 bản đồ Đêm 1/2/3.
- **Tài liệu hóa lý do thay đổi test Phase 1 (`docs/notes/phase2-spec-and-assumptions.md`):** Khi Ticket-02 chuẩn hóa `lantern_cost: 3 -> 10`, `safe_radius: 4 -> 6`, `pulse_cost: 1 -> 3`, và cộng `+10` điểm lúc nạp (`deposit`), cập nhật kịch bản regression Phase 1 kèm chú thích rõ ràng trong đầu file `tests/test_contract_phase1.py`.

### 2.2. Các Rủi ro / Lỗi Kỹ thuật Đã Phát hiện Sớm & Phòng tránh
| Vấn đề kỹ thuật trong Ticket-02 | Cách phát hiện trước khi code | Giải pháp triển khai |
|---|---|---|
| **Quy ước góc bản đồ (`Góc đo từ trục +X, ngược chiều kim đồng hồ`)** | Kiểm tra chéo tọa độ 5 đèn Đêm 1 (`L1 (0,0,25)` ứng với `90°`, `L2 (23.8,0,7.7)` ứng với `18°`) và vành tầng 1 Đêm 3 (`20°..160°` nằm ở nửa `z > 0`) | Dùng công thức chuẩn `x = cx + r*cos(rad), z = cz + r*sin(rad)` thay vì `sin/cos` đảo ngược của Phase 1. |
| **Quỹ đạo Bục nhảy Đêm 3 tại `(0,3,13)` lên Tầng 2 (`Y=6, R<=8`)** | Giải phương trình vật lý `Y(t) = 3 + 12t - 10t² = 6` → `t = 0.845s`, `Z = 13 - 8*0.845 = 6.24m <= 8.0m` | Xác nhận ở `Y=0` Mây đi tự do trên toàn đảo để ra chân dốc `R=30`, leo dốc lên `Y=3`, rồi nhảy bục `(0,3,13)` đáp chính xác lên đĩa tầng 2 (`Y=6`). |
| **Tạm dừng (`pause`) làm đóng băng `sim_tick` nhưng vẫn tăng `tick`** | Đọc kỹ mục cuối Phần 1: *"Khi đang tạm dừng: tick vẫn tăng nhưng sim_tick, thời gian, hồi chiêu, spawn, TTL đều đứng yên"* | Tách riêng bộ đếm `self.tick` và `self.sim_tick` ngay ở Bước 1 của `sim.step()`. |

### 2.3. Ước tính Token & Chiến lược Tiết kiệm Token (Phase 2)
- **Ước tính lượng token sử dụng ở Phase 2:**
  - Phân tích Ticket-02 & lập bảng 8 điểm biên + đặc tả: ~9.200 input tokens / ~2.600 output tokens.
  - Nâng cấp Core Simulation v1.1 (`src/sim.py`, `headless.py`) + 17 Unit/Scenario Tests: ~18.500 input tokens / ~7.800 output tokens.
  - Nâng cấp 3D Anime Client 3 Đêm (`web/sim.js`, `web/audio.js`, `web/index.html`, `web/main.js`) + Chụp bằng chứng Playwright: ~24.000 input tokens / ~9.400 output tokens.
  - **Tổng cộng Phase 2:** ~71.500 tokens (chi phí ước tính ~$0.34 USD).
  - **Lũy kế Phase 1 + Phase 2:** ~117.300 tokens (~$0.56 USD).
- **Cách tiết kiệm token:**
  - Phân tích toán học (góc cực, quỹ đạo parabol của bục nhảy, thứ tự 12 bước) ngay từ bước Spec giúp **17/17 bài test pass ngay lần chạy đầu tiên** (`Ran 17 tests in 1.363s — OK`), không tốn bất kỳ vòng lặp sửa lỗi nào.

---

## 3. Nhật Ký AI — Phase 3 (TICKET-03 — Change Request "Đèn cạn dầu" · Contract v1.2)
- **Phân tích Change Request & Viết ADR trước khi sửa code:**
  - Tổng hợp các luật bị thay thế (`[THAY THẾ]`) vào `docs/notes/phase3-adr-and-spec.md` (ADR-03) và `CHANGELOG.md`.
  - Quyết định dùng số nguyên `fuel_ticks` (đơn vị `1/60 fuel`, tối đa `6000`) giúp tránh hoàn toàn lỗi tích lũy dấu phẩy động khi đèn tự hao `1/60` mỗi tick và Bóng Mực hút `5/60` mỗi tick.
- **Lỗi AI phát hiện qua bộ test `test_shade_drain_and_pulse_bonus_15` & Cách sửa:**
  - *Hiện tượng:* Khi Bóng Mực hết thời gian choáng (`state_ticks_left == 0`) ở Bước 2 và chuyển về `wander`, ngay trong cùng tick đó ở Bước 8 (chuyển trạng thái) nó lại lập tức xét khoảng cách tới người chơi/đèn yếu và chuyển sang `chase` hoặc `drain`, làm mất trạng thái `wander` tại tick vừa tỉnh.
  - *Cách khắc phục:* Ghi nhận tập `just_unstunned_ids` ở Bước 2 và bỏ qua xét chuyển trạng thái ở Bước 8 trong đúng tick Bóng Mực vừa hết choáng. Sau khi sửa, toàn bộ **22/22 bài test** (Phase 1 + Phase 2 + Phase 3) đạt 100% trong `0.92s`.
- **Chi phí Token Phase 3:** ~28k tokens (nhờ tái sử dụng kiến trúc tách biệt `src/sim.py` ↔ `web/sim.js` và bộ harness `.githooks/pre-commit`).
