# CHANGELOG — Đảo Đèn Lồng

Tài liệu này ghi lại lịch sử phát hành qua cả 4 Phase (`v1.0 → v1.1 → v1.2 → v1.3 / Release v1.0.0`) và các **thay đổi phá vỡ tương thích (Breaking Changes)** của yêu cầu khách hàng.

---

## [Release v1.0.0 — Phase 4 · Contract v1.3] — TICKET-04 "Phát hành v1.0.0" (`tag: phase-4` & `v1.0.0`)

### 🚀 Tính năng Sản phẩm & Phi chức năng (Non-functional & Release Features)
1. **Chế độ Benchmark chuẩn hóa (`bench.py` · `bench_cmd`):**
   - Lệnh: `python3 bench.py --seed 42 --duration 30 --out bench.json` (và cảnh 3D trực tiếp tại `/web/index.html?bench=1&seed=42&duration=30`).
   - Tải Đêm 1 với đúng **200 Bóng Mực** ở trạng thái `wander`, **100 Đom Đóm**, **3 đèn `L1–L3` sáng với `fuel = 100`**, Mây đứng yên tại `(0,0,0)`, tắt các thực thể sáng tạo phụ và điều kiện kết thúc đêm.
   - Camera bay vòng tròn tâm `(0,0,0)`, bán kính `30m`, độ cao `Y = 15m`, nhìn vào `(0,0,0)`, ngược chiều kim đồng hồ `15s/vòng`, khởi động `3s` rồi đo `--duration` giây (`avg_fps = 116.5 >= 60`, `p1_low_fps = 64.3 >= 30`, `load_ms = 4 <= 10000`).
2. **Kiểm thử độ bền Soak Test 10 Đêm liên tiếp (`soak.py` · `soak_cmd`):**
   - Lệnh: `python3 soak.py --seed 7 --nights 10 --out soak.json`.
   - Chạy headless 10 Đêm liên tiếp (`Đêm 1 → 2 → 3` xoay vòng) trong cùng một tiến trình với input ngẫu nhiên theo seed (`7 + i`). Đạt `crashes = 0`, `mem_start_mb = 16.9 MB`, `mem_end_mb = 17.02 MB <= 1.2 * mem_start_mb`.
3. **Bảng xếp hạng cục bộ (`data/leaderboard.json` & `--export-leaderboard`):**
   - Cho phép nhập tên (`3–12` ký tự `[A-Za-z0-9_]`) sau màn Bình Minh (thắng Đêm 3) hoặc khi thua ở bất kỳ Đêm nào.
   - Lưu Top 10 trên đĩa cục bộ (`name, score, nights_won, achieved_at, seed`), sắp xếp theo `score` giảm dần, bằng điểm ưu tiên người đạt trước.
   - Hỗ trợ xem từ Menu chính (`🏆 Bảng Xếp Hạng`) và xuất qua CLI: `python3 run_game.py --export-leaderboard out.json`.
4. **Dễ tiếp cận toàn diện (Accessibility):**
   - **Đổi phím (Key Remapping):** Đổi phím cho cả 9 hành động (4 hướng di chuyển, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), tự động phát hiện trùng phím và cảnh báo, có nút `"↺ Khôi phục mặc định"`, lưu bền vững.
   - **Phụ đề & Chỉ báo hướng:** Phụ đề nổi kết hợp mũi tên chỉ hướng ở mép màn hình khi Bóng Mực xuất hiện, gió sắp thổi, 10 giây cuối và đèn có `fuel < 30`.
   - **Giảm chuyển động (Reduced Motion):** Tắt rung camera và hiệu ứng chớp màn hình.
   - **Cỡ chữ UI:** Tối thiểu `18px` ở `1280×720` kèm tùy chọn **Chữ lớn (`×1.25`)**.
5. **Nâng cấp chiến đấu 3D & Triển khai HTTPS:**
   - Bắn được cả **Bóng Mực** và **Ngọn Gió Lạc**; có thanh máu 3D, hoạt ảnh tháo/lắp băng đạn (`Anime.js`), hiệu ứng vỡ tan thành mảnh tinh thể và **biến mất 10 giây (`600` tick)** khi quái hoặc Gió Lạc hết máu (Gió Lạc rơi lại đom đóm đã cướp).
   - Bố cục lại 3 panel HUD trên cùng chống chồng lấn (`non-overlapping`).
   - Hỗ trợ chạy máy chủ HTTPS trực tiếp (`--host 0.0.0.0 --port 443 --ssl-cert ... --ssl-key ...`).

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
