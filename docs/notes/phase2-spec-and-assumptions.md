# Phase 2 — Đặc tả Yêu cầu, Tiêu chí Nghiệm thu & Lý do Cập nhật Thiết kế (TICKET-02 · Contract v1.1)

## 1. Lý do Thay đổi Thiết kế & Cập nhật Test từ Phase 1 sang Phase 2

Theo **TICKET-02**, nhà sản xuất yêu cầu chuẩn hóa toàn bộ thông số gameplay và mở rộng lên Contract `v1.1`:
1. **Chuẩn hóa hằng số (`tuning`):**
   - `carry_capacity`: đổi từ `5` → `10`.
   - `lantern_cost`: đổi từ `3` → `10`.
   - `pickup_radius`: đổi từ `1.5 m` → `1.0 m` (kèm điều kiện `|dY| <= 1.5 m`).
   - `interact_radius`: đổi từ `2.5 m` → `2.0 m`.
   - `safe_radius`: đổi từ `4.0 m` → `6.0 m`.
   - `pulse_cost`: đổi từ `1` → `3`; `pulse_radius`: `6.0 m` → `5.0 m`; `pulse_cooldown_s`: `1.5 s` → `3.0 s`; `pulse_stun_s`: `3.0 s` → `2.0 s` (`120` tick).
   - `shade_speed`: đổi từ `3.2 m/s` → `4.0 m/s` (Đêm 3: `4.5 m/s`).
   - `fall_enabled`: đổi từ `false` → `true` (rơi khi `Y < -10`).
2. **Thay đổi quy tắc tính điểm (`score`):**
   - `+10` điểm được cộng cho **mỗi đom đóm nạp vào đèn (`deposit`)** thay vì lúc nhặt (`mote_picked`).
   - `+5` điểm cho mỗi Bóng Mực trúng Tỏa Sáng (`per_stun: 5`, thay vì `25`).
   - Điểm thưởng khi thắng: `floor(time_left_s) * 2 + 50 * flames` (`per_flame_left: 50`, thay vì `100`).
3. **Thay đổi tập trạng thái Bóng Mực & Đom đóm rơi:**
   - Bóng Mực dùng đúng 5 trạng thái chuẩn: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
   - Khi bị Bóng Mực chạm, đom đóm rơi ra vành `1.5–2.5 m` thành thực thể `kind: "dropped"` tồn tại `480` tick và nhặt lại được từ tick sau.
4. **Cập nhật bộ test Phase 1:**
   - Các test Phase 1 trong `tests/test_contract_phase1.py` được cập nhật thông số kỳ vọng (`lantern_cost = 10`, `safe_radius = 6.0`, `pulse_cost = 3`, điểm cộng lúc `deposit`) kèm ghi chú lý do rõ ràng, đảm bảo mọi hành vi cốt lõi của Phase 1 vẫn hoạt động đúng (regression).

---

## 2. Tiêu chí Nghiệm thu (Acceptance Criteria) cho Từng Mục ở Phần 1, 2, 3, 4

| Mã | Tính năng / Yêu cầu (TICKET-02) | Tiêu chí Nghiệm thu (Acceptance Criteria) | Scenario / Test Kiểm chứng |
|---|---|---|---|
| **P2-01** | **Chuẩn hóa số liệu & Bản đồ Đêm 1 (Đảo Bến)** | Đảo tròn bán kính `40 m`, 5 đèn `L1..L5` đúng tọa độ chuẩn, 24 điểm sinh đom đóm (20 con lúc đầu, mỗi 240 tick sinh thêm 1 tới trần 30), 12 điểm sinh Bóng Mực ở `r=37 m` (2 con ở tick 300, mỗi 480 tick thêm 1 tới trần 6) | `test_night1_standardized_map_and_spawns` |
| **P2-02** | **Lướt (`Dash`)** | Khi `dash` chuyển `false -> true` và hết hồi chiêu (`90` tick từ lúc bắt đầu lướt): lướt `14 m/s` trong `12` tick (`0.2 s`) theo hướng đang di chuyển (hoặc hướng mặt nếu đứng yên); lướt trên không giữ nguyên `Y`; phát event `dash {}` | `tests/scenarios/p2_dash.json` & `test_dash_mechanic` |
| **P2-03** | **Rơi khỏi đảo (`Y < -10`) & Hồi sinh** | Khi đi ra ngoài mép đảo và rơi xuống `Y < -10`: bỏ qua bất tử, trừ `1` Ngọn Lửa, mất toàn bộ đom đóm đang mang, phát `player_hit {"by": "fall", "flames": n, "dropped": 0, "lost": m}`. Chờ `60` tick rồi hồi sinh tại `(0,0,0)`, vận tốc `0`, bất tử `90` tick (nếu hết Ngọn Lửa thì thua ngay `no_flames`) | `tests/scenarios/p2_fall_respawn.json` & `test_fall_off_island_and_respawn` |
| **P2-04** | **Bị đánh, Đom đóm rơi (`dropped`) & `recoil`** | Bóng Mực chạm Mây (`XZ <= 1.0 m, |dY| <= 1.5 m`): trừ `1` Ngọn Lửa, rơi `floor(carried/2)` đom đóm `kind="dropped"` ở vành `1.5–2.5 m` (TTL `480` tick, nhặt lại được từ tick sau), Mây bất tử `90` tick, Bóng Mực chuyển sang `recoil` lùi `2 m` trong `60` tick | `tests/scenarios/p2_hit_drop_recoil.json` & `test_shade_hit_dropped_motes_and_recoil` |
| **P2-05** | **Đêm 2 — Đảo Cau (2 Đảo, Cầu tre, Bục nhảy)** | Hai đảo tròn `R=28 m` tại `(0,0,0)` và `(70,0,0)`, cầu tre `x in [26,44], z in [-2,2]`, 6 đèn `L1..L6`. Bục nhảy `R=1 m` tại `(20,0,18)` và `(50,0,-18)` phóng Mây với `vy=14 m/s`, `v_xz=24 m/s` về tâm đảo kia, giữ vận tốc ngang tới khi chạm đất | `tests/scenarios/p2_night2_jumppad.json` & `test_night2_bridge_and_jumppad` |
| **P2-06** | **Gió Lạc (`Drifters` — Đêm 2 & 3)** | Sinh ở tick `1200, 2400...` (tối đa 2 con, `D1, D2...`). `idle` (`2 m/s`) → `chase` (`7 m/s`) khi Mây mang `>= 5` đom đóm và cách `<= 15 m`. Chạm (`XZ <= 1.2 m`) cướp `min(3, carried)`, phát `drifter_steal`, chuyển `flee` (`240` tick rồi `removed`). Trúng `pulse` khi `chase` → `flee` không cướp; trúng khi `flee` có đồ → thả lại toàn bộ đom đóm rơi, phát `drifter_drop`, biến mất sau `120` tick | `tests/scenarios/p2_drifter_steal_and_drop.json` & `test_drifter_steal_and_pulse_drop` |
| **P2-07** | **Bùa Gió (`Charms` — Đêm 2 & 3)** | Vị trí Đêm 2 `(35,0,0)`, Đêm 3 `(30,0,25)` và `(-30,0,25)`. Nhặt khi `XZ <= 1.0 m, |dY| <= 1.5 m`, phát `charm_picked`, hiệu lực `600` tick: tốc độ chạy `7.2 m/s` và Lướt không hồi chiêu. Hồi lại sau `2700` tick | `tests/scenarios/p2_charm.json` & `test_wind_charm_buff_and_respawn` |
| **P2-08** | **Đêm 3 — Đảo Chuông (3 Tầng, 2 Dốc, Bục nhảy, Tháp chuông, Gió mạnh)** | Đảo `R=45 m`: tầng 0 (`Y=0`), tầng 1 (`Y=3, r in [12,24], z > 0`), tầng 2 (`Y=6, r <= 8`), tháp chuông `r <= 2` ở tâm tầng 2; 2 dốc `30°` và `150°` (`r=30 -> 24`); bục nhảy `(0,3,13)` phóng `vy=12, vz=-8` đáp lên tầng 2; 7 đèn `L1..L7`; gió mạnh mỗi `30 s` kéo dài `5 s` đẩy `2 m/s` | `tests/scenarios/p2_night3_tiers_and_wind.json` & `test_night3_tiers_ramps_jumppad_and_wind` |
| **P2-09** | **Tạm dừng (`Pause / Resume`)** | Khi `pause` chuyển `false -> true`: phát `paused {}`, `state = "paused"`, `tick` vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên. Nhấn `pause` lần nữa phát `resumed {}` và chạy tiếp | `tests/scenarios/p2_pause_resume.json` & `test_pause_and_resume_freezes_sim_tick` |
| **P2-10** | **Chuỗi 3 Đêm, Menu, Cài đặt, Âm thanh, HUD chuẩn & Bảng màu chuẩn** | Menu chính → Giới thiệu Đêm (lời Ông Đăng) → Chơi → Kết quả → Đêm kế tiếp → Màn Bình Minh tổng điểm. Menu Pause (`Esc/P`), lưu cài đặt `localStorage`, đầy đủ 10 hiệu ứng âm thanh, HUD đúng vị trí chuẩn (đồng hồ đỏ nhấp nháy `<= 30s`, thanh 10 ô đom đóm, icon cooldown Lướt/Tỏa Sáng, mũi tên chỉ đèn ngoài màn hình), bảng màu đúng mã Hex chuẩn, ánh sáng môi trường `0.15 + 0.55 * (lit/total)` | Kiểm chứng trên trình duyệt Playwright Firefox & ảnh chụp 3 Đêm |
| **P2-11** | **Hiệu năng Headless & 3D FPS** | Chạy headless 1 Đêm đầy đủ (`21.600` tick) hoàn thành trong `<= 30 giây` (thực tế `< 1.5 giây`); bản 3D đạt `>= 30 FPS` trung bình ở `1280x720` | `test_headless_21600_ticks_performance` & đo FPS trên trình duyệt |
