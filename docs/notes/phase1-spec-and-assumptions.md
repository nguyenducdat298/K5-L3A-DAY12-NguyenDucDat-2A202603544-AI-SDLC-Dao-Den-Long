# Phase 1 — Đặc tả Yêu cầu, Tiêu chí Nghiệm thu & Giả định (PRD-0)

## 1. Tóm tắt Yêu cầu Bắt buộc & Tiêu chí Nghiệm thu

| Mã | Yêu cầu (PRD-0 & Test Contract v1.0) | Tiêu chí nghiệm thu (Acceptance Criteria) | Cách kiểm chứng |
|---|---|---|---|
| **R1** | Màn chơi Đêm 1 – Đảo Bến có 5 Đèn Lồng Lớn (`L1..L5`), nhân vật Mây xuất phát ở `(0,0,0)` | Khi khởi tạo Đêm 1 không có scenario, có đúng 5 đèn `L1..L5`, `player.pos = [0,0,0]`, `flames = 3`, `time_left_s = 300` | Unit test + Snapshot `tick = 0` |
| **R2** | Di chuyển 3D, nhảy, xoay hướng theo `cam_yaw_deg` | Vector `move: [x, z]` chuẩn hóa khi độ dài `> 1`, xoay theo `x' = x·cosθ + z·sinθ`, `z' = -x·sinθ + z·cosθ`, tốc độ `player_speed` m/s ở 60 tick/s | Scenario di chuyển 120 ticks → `pos = [0, 0, 12]` |
| **R3** | Nhặt đom đóm (`mote_picked`) trong `pickup_radius` | Khi khoảng cách XZ `<= pickup_radius` và `carried < carry_capacity`, xóa mote, `carried += 1`, `score += per_mote`, phát event `mote_picked` | Scenario & Unit test pickup |
| **R4** | Nạp ánh sáng (`deposit`) và thắp đèn (`lantern_lit`) trong `interact_radius` | Khi `interact` chuyển `false -> true` gần đèn chưa thắp trong `interact_radius` và `carried > 0`, nạp `amount = min(carried, lantern_cost - deposited)`, phát `deposit`; nếu `deposited == lantern_cost` thì `lit = true`, `score += per_lantern`, phát `lantern_lit` | Scenario thắp đèn & Unit test |
| **R5** | Bóng Mực (`shades`) đuổi người chơi và gây sát thương (`player_hit`) | Shade ở trạng thái `chase` tiến về `player.pos` với tốc độ `shade_speed`; khi khoảng cách XZ `<= shade_hit_radius` và hết `invuln_s`, giảm 1 `flames`, rơi `floor(carried * hit_drop_ratio)` đom đóm, phát `player_hit` | Scenario va chạm Bóng Mực |
| **R6** | Tỏa sáng (`pulse`) xua Bóng Mực và vùng an toàn `safe_radius` quanh đèn | Khi `pulse` chuyển `false -> true`, nếu `carried >= pulse_cost` và hết `pulse_cooldown_s`: trừ `pulse_cost`, mọi shade trong `pulse_radius` bị đẩy lùi `pulse_push_m`, chuyển sang `stunned` trong `pulse_stun_s`, cộng `per_stun` mỗi shade, phát `pulse`. Đèn đã thắp (`lit: true`) chặn shade ngoài `safe_radius` | Scenario pulse & safe zone |
| **R7** | Điều kiện Thắng / Thua (`game_over`) và dòng kết thúc (`end`) | Thắp đủ 5 đèn → `won` (`reason: "all_lit"`), cộng điểm thưởng `per_second_left` và `per_flame_left`. `flames == 0` → `lost` (`reason: "no_flames"`). `time_left_s <= 0` → `lost` (`reason: "dawn"`). Luôn kết thúc file JSONL bằng dòng `end` | 3 Scenario thắng/thua |
| **R8** | Chế độ Headless CLI, Tính tất định & Mã thoát | Đúng cú pháp CLI, 60 tick/s, cùng `--seed` + `--scenario` + `--inputs` cho output giống hệt 100% (kể cả ID). Sai định dạng file inputs/scenario thoát mã `2` kèm thông báo ra `stderr` | Test determinism SHA-256 & negative tests exit code `2` |
| **R9** | Đồ họa 3D phong cách Anime cổ tích, HUD, âm thanh, chơi lại | Giao diện 3D Three.js Cel-shading + Anime.js UI mượt mà, hiển thị Mây đội nón lá treo đèn lồng nhỏ, Đảo Bến sáng dần khi thắp đèn, nút Chơi lại hoạt động | Chạy `python3 run_game.py` & chụp ảnh bằng chứng |

---

## 2. Các Giả định (Assumptions) cho Chỗ Mơ hồ trong PRD-0

1. **Cơ chế nạp đom đóm (`interact`):**
   - Một lần kích hoạt `interact` (`false -> true`) sẽ nạp **tối đa số đom đóm đèn đó còn thiếu** (`amount = min(carried, lantern_cost - deposited)`), giúp người chơi không phải bấm nhiều lần ở một đèn và khớp với ví dụ Test Contract.
   - Nếu đứng trong `interact_radius` của nhiều đèn chưa thắp, ưu tiên đèn gần nhất theo khoảng cách XZ (nếu bằng nhau thì theo thứ tự ID `L1..L5`).
2. **Hiệu lực của `safe_radius`:**
   - Chỉ các Đèn Lồng Lớn **đã được thắp sáng (`lit: true`)** mới tỏa sáng tạo vùng an toàn `safe_radius`. Bóng Mực không thể đi vào bên trong bán kính `safe_radius` của đèn đã thắp (bị đẩy ra rìa `>= safe_radius`).
3. **Cơ chế `pulse` (Tỏa sáng):**
   - Nếu `carried < pulse_cost` hoặc đang trong thời gian hồi chiêu (`pulse_cooldown_s`), thao tác bấm `pulse` bị bỏ qua (không trừ đom đóm, không phát sự kiện `pulse`).
   - Nếu hợp lệ, trừ `pulse_cost`, đặt cooldown, đẩy các Bóng Mực trong `pulse_radius` ra xa `pulse_push_m` theo hướng từ Mây tới Bóng Mực (nếu trùng tâm thì đẩy theo hướng `+Z`), chuyển trạng thái Bóng Mực sang `"stunned"` trong `pulse_stun_s` giây và cộng `score.per_stun` cho mỗi Bóng Mực bị choáng.
4. **Đánh rơi đom đóm khi bị chạm (`hit_drop_ratio`):**
   - Số đom đóm đánh rơi được tính bằng `floor(carried * hit_drop_ratio)`. Số đom đóm rơi này biến mất vào sương đen (không tự sinh thành mote mới trên đất) để giữ tính tất định rõ ràng.
5. **Điểm thưởng cuối màn (`per_second_left`, `per_flame_left`):**
   - Chỉ cộng khi người chơi **Thắng (`all_lit`)**: `bonus = round(time_left_s * per_second_left) + flames * per_flame_left`. Khi thua (`no_flames` hoặc `dawn`), người chơi giữ nguyên số điểm đã tích lũy trong màn.
6. **Rơi khỏi đảo (`fall_enabled: false`):**
   - Ở Đêm 1, đặt `fall_enabled: false` để nhân vật không bị phạt rơi khỏi đảo và không làm cản trở các kịch bản tọa độ xa trong bài kiểm thử tự động. Trên bản đồ 3D, rìa Đảo Bến có hàng rào đá/mây dẫn hướng trực quan.
7. **Thứ tự xử lý trong 1 tick (Bước `k` → Trạng thái & Sự kiện ở `tick = k + 1`):**
   1. Giảm thời gian hồi chiêu (`pulse_cooldown`, `invuln_timer`).
   2. Đọc input của `tick = k`, phát hiện sườn lên (`false -> true`) của `jump`, `interact`, `pulse` và cập nhật vị trí Mây.
   3. Kiểm tra nhặt đom đóm (`mote_picked`).
   4. Kiểm tra nạp đèn (`deposit` và `lantern_lit`).
   5. Kiểm tra tỏa sáng (`pulse`).
   6. Cập nhật Bóng Mực (giảm `stun_timer`, di chuyển `chase`, chặn bởi `safe_radius` của đèn đã thắp, và sinh thêm Bóng Mực nếu `random_shades: true`).
   7. Kiểm tra va chạm Bóng Mực (`player_hit`).
   8. Cập nhật `time_left_s = initial_duration_s - (k + 1) / 60` và kiểm tra kết thúc màn theo thứ tự: Thắng (`all_lit`) → Thua hết máu (`no_flames`) → Thua hết giờ (`dawn`).

---

## 3. Thông số `tuning` đã chọn trong `game.contract.json`

| Thông số | Giá trị | Ý nghĩa |
|---|---|---|
| `player_speed` | `6.0` | Tốc độ di chuyển của Mây (6 m/s — khớp ví dụ 120 ticks đi được 12m trong Contract) |
| `carry_capacity` | `5` | Số đom đóm tối đa Mây mang theo cùng lúc |
| `lantern_cost` | `3` | Số đom đóm cần để thắp sáng 1 Đèn Lồng Lớn |
| `lantern_count_night1` | `5` | 5 Đèn Lồng Lớn (`L1..L5`) của Đêm 1 – Đảo Bến |
| `pickup_radius` | `1.5` | Bán kính tự động nhặt đom đóm (m) |
| `interact_radius` | `2.5` | Bán kính tương tác nạp ánh sáng vào đèn (m) |
| `pulse_cost` | `1` | Số đom đóm tiêu hao cho 1 lần Tỏa sáng |
| `pulse_radius` | `6.0` | Bán kính sóng ánh sáng làm choáng Bóng Mực (m) |
| `night1_duration_s` | `300` | Thời lượng Đêm 1 (300 giây = 5 phút) |
| `flames` | `3` | Số ngọn lửa sinh mệnh (máu) ban đầu |
| `invuln_s` | `1.5` | Thời gian bất tử tạm thời sau khi bị chạm (giây) |
| `hit_drop_ratio` | `0.5` | Tỉ lệ đom đóm bị rơi khi trúng đòn (`floor(carried * 0.5)`) |
| `pulse_stun_s` | `3.0` | Thời gian Bóng Mực bị choáng (giây) |
| `pulse_push_m` | `4.0` | Khoảng cách đẩy lùi Bóng Mực khi trúng `pulse` (m) |
| `pulse_cooldown_s` | `1.5` | Thời gian hồi chiêu giữa 2 lần `pulse` (giây) |
| `safe_radius` | `4.0` | Bán kính vùng an toàn quanh đèn đã thắp mà Bóng Mực không vào được (m) |
| `shade_speed` | `3.2` | Tốc độ đuổi của Bóng Mực (m/s) |
| `shade_hit_radius` | `1.0` | Bán kính va chạm giữa Bóng Mực và Mây (m) |
| `fall_enabled` | `false` | Không phạt rơi khỏi đảo ở Đêm 1 |
| `score` | `per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 2, per_flame_left: 100` | Công thức tính điểm |
