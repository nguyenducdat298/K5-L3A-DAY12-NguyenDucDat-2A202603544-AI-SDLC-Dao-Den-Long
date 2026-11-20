# Ghi chép Phase 1 — PRD-0 & Test Contract v1.0

## 1. Giả định cho các điểm mơ hồ trong PRD-0

| Hạng mục | Giả định đã chọn | Lý do |
|---|---|---|
| Nạp đèn (`interact`) | Nạp tối đa `min(carried, lantern_cost - deposited)` trong 1 lần bấm; ưu tiên đèn chưa thắp gần nhất theo XZ (hòa chọn theo `L1..L5`). | Tránh thao tác lặp lại rườm rà khi chơi và dễ kiểm thử. |
| Vùng an toàn (`safe_radius`) | Chỉ áp dụng cho đèn đã thắp (`lit: true`). Bóng Mực bị đẩy/kẹp ngoài rìa `safe_radius` và không gây hit cho người chơi đứng trong vùng này. | Khớp tinh thần "Bóng Mực sợ những chiếc đèn". |
| `pulse` | Bỏ qua nếu `carried < pulse_cost` hoặc đang `cooldown > 0`. Đẩy theo vector `(shade - player)` (trùng tâm đẩy theo hướng nhìn). | Ngăn spam pulse miễn phí và đảm bảo deterministic. |
| Điểm thưởng & `dawn` | `dawn` (hết giờ) là thua. `per_second_left` và `per_flame_left` chỉ cộng khi thắng (`all_lit`). | Thưởng cho việc hoàn thành màn nhanh và giữ máu. |
| `hit_drop_ratio` | `floor(carried * hit_drop_ratio)`, đom đóm rơi biến mất khỏi túi. | Không sinh entity ngẫu nhiên khi bị đánh, giữ headless đơn giản. |
| `fall_enabled` | `false` ở Đêm 1; kẹp vị trí người chơi trong bán kính Đảo Bến `25.0m`. | Tập trung đúng cơ chế cốt lõi của Phase 1. |

## 2. Nhật ký dùng AI & Token ước tính
- **Công cụ:** Antigravity Agent + Subagent `prd-analyst` (phân tích PRD-0 & Test Contract v1.0) + skill `submitVinAI` & `brainstorming`.
- **Cách tiết kiệm token:**
  - Dùng subagent `prd-analyst` một lần để rà soát toàn bộ edge-case trước khi viết code.
  - Chốt kiến trúc pure-Python `src/core/sim.py` dùng chung cho cả headless và 3D client, tránh viết lặp logic hai nơi.
  - Giữ `AGENTS.md` ngắn gọn (~20 dòng).
- **Ước tính token Phase 1:** ~35k–45k tokens (bao gồm phân tích, viết code core/headless/client, test và tài liệu).
- **Lỗi AI phát hiện & sửa:** Trong lần kiểm tra import `src/client/app.py`, phát hiện `GL_FOG_EXP2` không tồn tại trong `OpenGL.GL` của PyOpenGL (đúng tên là `GL_EXP2`). Đã sửa ngay và chạy kiểm tra lại thành công.
