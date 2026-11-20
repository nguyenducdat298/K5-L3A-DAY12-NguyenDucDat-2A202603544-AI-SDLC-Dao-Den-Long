# ADR-03 & Đặc tả Phase 3 — "Đèn cạn dầu" (TICKET-03 · Test Contract v1.2)

## 1. Architecture Decision Record (ADR-03): Thay đổi Mô hình Trạng thái Đèn, Bóng Mực Hút Dầu & Luật Thắng

- **Trạng thái:** Đã chấp thuận & Triển khai tại tag `phase-3`
- **Bối cảnh:** Ở Phase 1–2 (`Contract v1.0–v1.1`), đèn đã thắp (`lit: true`) sẽ sáng vĩnh viễn và trò chơi kết thúc thắng ngay khi thắp đủ đèn (`all_lit`). Playtest cho thấy người chơi hoàn thành sớm trong ~2 phút, thiếu áp lực giữ đảo ở cuối màn. **TICKET-03** yêu cầu chuyển sang cơ chế **Đèn hao dầu (`fuel`)**, **Bóng Mực hút dầu (`drain`)**, **Sức chứa động (`capacity`)** và **Sống sót tới Bình Minh (`dawn_survived`)**.

### Quyết định Thiết kế Kỹ thuật
1. **Biểu diễn Nhiên liệu Chính xác Tuyệt đối bằng Số nguyên `1/60` (`fuel_ticks`):**
   - Để tránh sai số dấu phẩy động IEEE-754 khi trừ `1/60` (hao tự nhiên) và `5/60` (Bóng Mực hút) qua `18.000` tick, mỗi đèn lưu `fuel_ticks: int` với quy ước **`1` đơn vị fuel = `60` `fuel_ticks`** (`fuel_max = 100` $\iff$ `6000` `fuel_ticks`; ngưỡng yếu `low_fuel_threshold = 30` $\iff$ `1800` `fuel_ticks`).
   - Mỗi tick ở Bước 2: đèn đang sáng giảm `1 + 5 * num_draining_shades` đơn vị `fuel_ticks`.
   - Chỉ khi xuất ra Snapshot/Event mới quy đổi sang số thực làm tròn 1 chữ số thập phân: `round(fuel_ticks / 60.0, 1)` (hoặc `0` khi đèn tắt).
   - Công thức châm dầu `ceil((100 - fuel) / 10)` được tính chính xác bằng số nguyên: `((6000 - fuel_ticks) + 599) // 600`.
2. **Máy trạng thái Đèn Lồng (Lantern State Machine):**
   - `UNLIT_NEVER` (`lit=False, ever_lit=False, fuel_ticks=0`): cần `10` đom đóm để thắp lần đầu (`+100` điểm, `relight: false`, `successful_lights += 1`).
   - `LIT_SAFE` (`lit=True, fuel_ticks >= 1800`): có vùng an toàn `6.0 m` chặn Bóng Mực; nhận châm dầu (`refuel`) khi `fuel_ticks < 6000`.
   - `LIT_WEAK` (`lit=True, 0 < fuel_ticks < 1800`): **mất vùng an toàn `6.0 m`**, thu hút Bóng Mực đang `wander` lại gần để `drain`; nếu được châm dầu lên `>= 1800` (`fuel >= 30`), kích hoạt lại vùng an toàn và đẩy mọi Bóng Mực trong phạm vi `6.0 m` ra mép trong tối đa `30` tick.
   - `UNLIT_RELIGHTABLE` (`lit=False, ever_lit=True, fuel_ticks=0, deposited=0`): khi `fuel_ticks <= 0` ngay sau Bước 2, phát `lantern_out`; chỉ cần `relight_cost = 5` đom đóm để thắp lại (`+40` điểm, `relight: true`, `relit_count += 1`, `successful_lights += 1`).
3. **Máy trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `drain`, `recoil`, `stunned`):**
   - Bổ sung trạng thái `drain`: Bóng Mực ở `wander` ưu tiên tìm đèn đang sáng có `fuel < 30` gần nhất (hòa thì chọn `id` nhỏ hơn); nếu không có mới tìm đèn đang tắt gần nhất. Khi cách đèn yếu `<= 2.0 m` (XZ), chuyển sang `drain`, đứng yên hút `5 fuel/s` và mỗi `60` tick phát sự kiện `fuel_drain {lantern_id, shade_id, fuel}`.
   - Chuyển khỏi `drain`: sang `chase` nếu Mây vào `<= 6.0 m`; sang `stunned` nếu trúng Tỏa Sáng (`+15` điểm thay vì `+5`); sang `wander` nếu đèn tắt, `fuel >= 30`, hoặc khoảng cách `> 2.0 m`.
   - Khi hết choáng (`stunned` về 0 tick), Bóng Mực luôn chuyển về `wander`.
4. **Luật Thắng/Thua Mới ở Bước 11:**
   - Bỏ thắng sớm `all_lit`.
   - Ở mọi tick (kể cả tick bình minh): kiểm tra `flames <= 0` trước → thua `no_flames`.
   - Khi `time_left_s <= 0` (bình minh) và `flames > 0`: nếu số đèn đang sáng `>= ceil(0.6 * total_lanterns)` (`3/5` ở Đêm 1, `4/6` ở Đêm 2, `5/7` ở Đêm 3) → thắng `dawn_survived` (cộng thưởng `50 + floor(fuel)` cho mỗi đèn đang sáng và `50 * flames`); ngược lại → thua `dawn`.

---

## 2. Tiêu chí Nghiệm thu (Acceptance Criteria) cho Phase 3

| Mã | Yêu cầu (TICKET-03 · Contract v1.2) | Tiêu chí Nghiệm thu | Test Kiểm chứng |
|---|---|---|---|
| **P3-01** | Hao dầu `1.0/s`, hết dầu tắt đèn (`lantern_out`), nhớ `ever_lit: true`, thắp lại tốn `5` đom đóm (`relight: true`, `+40` điểm) | Đèn sáng giảm đúng `1/60` fuel mỗi tick; về `0` phát `lantern_out`, `deposited=0`; nạp `5` đom đóm thắp lại phát `lantern_lit {relight: true}`, `relit_count=1` | `test_lantern_fuel_decay_out_and_relight` |
| **P3-02** | Châm dầu (`refuel`) cho đèn đang sáng nhưng chưa đầy (`fuel < 100`), đẩy Bóng Mực khi châm từ `< 30` lên `>= 30` | `used = min(carried, ceil((100 - fuel)/10))`, `fuel = min(100, fuel + 10*used)`, phát `refuel`, cộng `+5 * used`; đèn đầy (`fuel=100`) được bỏ qua; châm lên `>= 30` đẩy Bóng Mực trong `6m` ra mép | `test_refuel_and_safe_zone_restoration` |
| **P3-03** | Bóng Mực tìm đèn yếu (`fuel < 30`), chuyển sang `drain` ở `<= 2m`, hút `5 fuel/s`, phát `fuel_drain` mỗi `60` tick, trúng `pulse` khi `drain` được `+15` điểm | Bóng Mực `wander` đi tới đèn `fuel < 30`, vào `<= 2m` chuyển `drain`, đèn mất tổng `6 fuel/s` (`1` tự hao + `5` bị hút), tick 60 phát `fuel_drain`; trúng `pulse` cộng `+15` điểm | `test_shade_drain_and_pulse_bonus_15` |
| **P3-04** | Sức chứa động `capacity = min(20, 10 + 2 * successful_lights)` | Đầu Đêm `capacity = 10` (trừ khi scenario đặt `successful_lights`); mỗi lần thắp mới hoặc thắp lại thành công trong Đêm tăng `capacity` thêm `2` tới tối đa `20` | `test_dynamic_capacity_progression` |
| **P3-05** | Luật thắng `dawn_survived` (`>= ceil(0.6 * N)` đèn sáng khi hết giờ) & không thắng sớm khi thắp đủ đèn | Thắp đủ 5/5 đèn lúc chưa hết giờ vẫn `state="playing"`; hết giờ còn `>= 3/5` đèn sáng → `won` (`reason: "dawn_survived"`), cộng `50 + floor(fuel)` mỗi đèn sáng + `50 * flames`; `< 3/5` → `lost` (`reason: "dawn"`) | `test_dawn_survived_win_and_no_early_win` |
| **P3-06** | Chế độ mù màu ("Bảng màu dễ phân biệt") & Phân biệt đèn không cần màu | Bật chế độ mù màu đổi viền/mắt Bóng Mực sang `#00B3FF`, cảnh báo UI sang `#FFFFFF` kèm `⚠`; đèn tắt xẹp `20%` và có vết rách; đèn `fuel < 30` nhấp nháy `1 Hz` kèm thanh dầu | Kiểm chứng trên trình duyệt Playwright Firefox & ảnh chụp Phase 3 |
