# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness · Phase 4 · Release v1.0.0 · Contract v1.3)

Tài liệu hướng dẫn cố định cho AI Agent trong dự án **Đảo Đèn Lồng**. Giữ ngắn gọn để tiết kiệm context token.

## 1. Lệnh chuẩn của dự án
- **Build / Kiểm tra cú pháp:** `python3 -m py_compile headless.py run_game.py bench.py soak.py src/sim.py`
- **Chạy game 3D (có giao diện 3 Đêm & Bảng xếp hạng):** `python3 run_game.py`
- **Xuất Bảng xếp hạng cục bộ (Top 10):** `python3 run_game.py --export-leaderboard out.json`
- **Chạy chế độ Headless (Test Contract v1.3):**
  `python3 headless.py --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]`
- **Chạy Benchmark chuẩn (200 Bóng Mực, 100 Đom Đóm, L1–L3 fuel 100):**
  `python3 bench.py --seed 42 --duration 30 --out bench.json`
- **Chạy Soak Test độ bền (10 Đêm liên tiếp):**
  `python3 soak.py --seed 7 --nights 10 --out soak.json`
- **Chạy toàn bộ bộ kiểm thử tự động (26 tests):** `python3 -m unittest discover -s tests -v`

## 2. Quy tắc kiến trúc bắt buộc (Cập nhật Phase 3 — Contract v1.2)
1. **Độ chính xác Nhiên liệu Đèn (`fuel_ticks`):**
   - Lưu nhiên liệu đèn bằng số nguyên đơn vị `1/60` (`fuel_ticks`, tối đa `6000` = `100.0` fuel; ngưỡng mất vùng an toàn `< 1800` = `30.0` fuel).
   - Ở Bước 2 mỗi tick: đèn sáng giảm `1` (tự hao) + `5` cho mỗi Bóng Mực đang `drain` đèn đó. Mỗi `60` tick đang hút phát `fuel_drain {lantern_id, shade_id, fuel}`. Ngay sau Bước 2, nếu `fuel_ticks <= 0` thì tắt đèn, `deposited = 0`, `ever_lit = True`, phát `lantern_out {lantern_id}`.
2. **Tương tác Đèn, Thắp lại & Châm dầu (Bước 5):**
   - Chỉ chọn đèn chưa sáng hoặc đang sáng nhưng `fuel_ticks < 6000` trong `2.0 m` (gần nhất, hòa thì ID nhỏ hơn).
   - Đèn chưa từng sáng cần `10` đom đóm (`+100` điểm, `relight: false`); đèn `ever_lit` chỉ cần `5` đom đóm (`+40` điểm, `relight: true`, `relit_count += 1`). Mỗi lần thắp thành công trong Đêm tăng `successful_lights += 1` → `capacity = min(20, 10 + 2 * successful_lights)`.
   - Đèn đang sáng (`fuel < 100`): châm `used = min(carried, ceil((100 - fuel)/10))`, phát `refuel {lantern_id, amount, fuel}`. Nếu châm lên `>= 30` đẩy Bóng Mực trong `6 m` ra mép trong tối đa `30` tick.
   - Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại, châm dầu) cộng **`+5` điểm**.
3. **Bóng Mực Hút Dầu (`drain`) & Tỏa Sáng:**
   - Bóng Mực ở `wander` ưu tiên đi tới đèn sáng có `fuel < 30` gần nhất (không có mới đi tới đèn tắt gần nhất); vào `<= 2.0 m` chuyển sang `drain`.
   - Trúng `pulse` khi đang `drain` cộng **`+15` điểm** (trạng thái khác cộng **`+5` điểm**). Hết `stunned` luôn về `wander`.
4. **Luật Thắng/Thua Mới (Bước 11):**
   - Không còn thắng sớm `all_lit`. Hết Ngọn Lửa luôn thua `no_flames` trước.
   - Khi hết giờ (`240 / 270 / 300 s`): nếu số đèn sáng `>= ceil(0.6 * tổng_đèn)` → thắng `dawn_survived` (thưởng `50 + floor(fuel)` mỗi đèn sáng + `50 * flames`); ngược lại → thua `dawn`.

## 3. Quy tắc kiểm chứng & Git
- Chạy `python3 -m unittest discover -s tests` trước mọi commit (cưỡng chế bởi `.githooks/pre-commit`).
- Khi luật mới thay thế luật cũ, cập nhật test cũ kèm ghi chú rõ lý do và ghi vào `CHANGELOG.md`.
