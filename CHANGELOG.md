# CHANGELOG — Đảo Đèn Lồng

Tài liệu này ghi lại lịch sử phát hành qua các Phase và các **thay đổi phá vỡ tương thích (Breaking Changes)** của yêu cầu khách hàng.

---

## [Phase 3 — Contract v1.2] — TICKET-03 "Đèn cạn dầu" (`tag: phase-3`)

### ⚠️ Breaking Changes (Thay đổi thay thế luật cũ của Phase 1 & Phase 2)
1. **[THAY THẾ] Luật thắng (`all_lit` → `dawn_survived`):**
   - Thắp sáng tất cả đèn **không còn kết thúc Đêm sớm**. Giá trị `game_over.reason = "all_lit"` bị loại bỏ.
   - Điều kiện thắng mới: Mây còn sống khi hết giờ (bình minh) và số đèn đang sáng tại tick cuối `>= ceil(0.6 * tổng_đèn)` (Đêm 1: `3/5`, Đêm 2: `4/6`, Đêm 3: `5/7`) → phát `game_over {"result": "won", "reason": "dawn_survived"}`.
   - Thời lượng Đêm 1 / 2 / 3 đổi từ `300 / 330 / 360 s` thành **`240 / 270 / 300 s`**.
2. **[THAY THẾ] Luật "Đèn đã sáng không nhận thêm đom đóm" → Cơ chế Nhiên liệu (`fuel`) & Châm dầu (`refuel`):**
   - Đèn vừa thắp có `fuel = 100`, tự hao `1.0 fuel/s` (`1/60` mỗi tick).
   - Đèn đang sáng nhưng `fuel < 100` nhận tương tác châm dầu: `used = min(carried, ceil((100 - fuel)/10))`, phát sự kiện mới `refuel {lantern_id, amount, fuel}`.
   - Khi `fuel <= 0` ngay sau Bước 2: đèn tắt, `deposited = 0`, nhớ `ever_lit = true`, phát sự kiện mới `lantern_out {lantern_id}`.
   - Đèn có `ever_lit = true` khi thắp lại chỉ tốn **`relight_cost = 5`** đom đóm (thay vì `10`); sự kiện `lantern_lit` thêm trường bắt buộc `relight: true | false`.
3. **[THAY THẾ] Luật "Bóng Mực không bao giờ vào vùng an toàn" → Đèn yếu mất vùng an toàn & Bóng Mực hút dầu (`drain`):**
   - Đèn đang sáng nhưng có `fuel < 30` (`low_fuel_threshold = 30`) **mất vùng an toàn `6.0 m`**.
   - Bóng Mực ở trạng thái `wander` ưu tiên đi tới đèn sáng có `fuel < 30` gần nhất; khi cách `<= 2.0 m` chuyển sang trạng thái mới `drain`, đứng yên hút `5.0 fuel/s` và phát sự kiện `fuel_drain {lantern_id, shade_id, fuel}` mỗi `60` tick.
   - Khi hết choáng (`stunned`), Bóng Mực luôn trở về `wander`.
4. **[THAY THẾ] Toàn bộ công thức tính điểm (`score`):**
   - Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại, châm dầu): **`+5`** (thay vì `+10`).
   - Thắp đèn lần đầu: **`+100`**; thắp lại đèn (`ever_lit`): **`+40`**.
   - Bóng Mực trúng Tỏa Sáng: **`+5`** mỗi con, hoặc **`+15`** nếu ngay trước đó nó đang ở trạng thái `drain`.
   - Thưởng khi thắng ở bình minh: **`+50 + floor(fuel)`** cho mỗi đèn đang sáng và **`+50`** cho mỗi Ngọn Lửa còn lại. **Bỏ thưởng thời gian (`per_second_left`)**.

### ✨ Tính năng mới (Non-breaking Additions)
- **Sức chứa tăng dần (`capacity`):** `capacity = min(20, 10 + 2 * successful_lights)`.
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** Lưu trong cài đặt (`#00B3FF` cho viền/mắt Bóng Mực, `#FFFFFF` + `⚠` cho cảnh báo UI); đèn tắt xẹp 20% + vết rách; đèn `fuel < 30` nhấp nháy `1 Hz` kèm thanh nhiên liệu.
- **Schema Snapshot & Scenario v1.2:** Snapshot đèn thêm `fuel, ever_lit, relit_count`; player thêm `capacity`. Scenario hỗ trợ `lit, fuel, ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.

---

## [Phase 2 — Contract v1.1] — TICKET-02 "Ba hòn đảo" (`tag: phase-2`)
- Chuẩn hóa số liệu điều khiển, bản đồ 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), bổ sung Lướt (`dash`), Bục nhảy, Gió Lạc (`drifters`), Bùa Gió (`charms`), Gió mạnh Đêm 3 (`wind`), Tạm dừng (`pause`) và 5 trạng thái Bóng Mực (`spawning, wander, chase, recoil, stunned`).

## [Phase 1 — Contract v1.0] — PRD-0 "Đảo Đèn Lồng" (`tag: phase-1`)
- Bản phát hành đầu tiên: Đêm 1 – Đảo Bến với 5 Đèn Lồng Lớn, lõi mô phỏng tất định 60 tick/s, CLI headless và giao diện 3D Anime Cel-Shading.
