# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness · Phase 2 · Contract v1.1)

Tài liệu hướng dẫn cố định cho AI Agent trong dự án **Đảo Đèn Lồng**. Giữ ngắn gọn để tiết kiệm context token.

## 1. Lệnh chuẩn của dự án
- **Build / Kiểm tra cú pháp:** `python3 -m py_compile headless.py run_game.py src/sim.py`
- **Chạy game 3D (có giao diện 3 Đêm):** `python3 run_game.py`
- **Chạy chế độ Headless (Test Contract v1.1):**
  `python3 headless.py --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]`
- **Chạy toàn bộ bộ kiểm thử tự động:** `python3 -m unittest discover -s tests -v`

## 2. Quy tắc kiến trúc bắt buộc (Cập nhật Phase 2 — Contract v1.1)
1. **Tách biệt tuyệt đối Core Logic và 3D View:**
   - `src/sim.py` và `headless.py` chỉ dùng Python 3 standard library, chạy 21.600 tick (1 Đêm đầy đủ) trong `< 2 giây` (yêu cầu `≤ 30 giây`).
   - Mọi thông số gameplay chuẩn hóa theo **TICKET-02 Phần 1** và đọc từ `game.contract.json` (`contract_version: "1.1"`).
2. **Thứ tự xử lý 12 bước cố định trong 1 tick (60 tick/s):**
   1. Đọc input (`pause` xử lý trước; khi `paused` thì `tick` tăng nhưng `sim_tick` và mọi bộ đếm đứng yên).
   2. Giảm bộ đếm: thời gian, hồi chiêu (`dash`, `pulse`), bất tử (`invuln`), choáng/lùi (`shade`), bùa (`charm`), TTL đom đóm rơi (`480` tick), hồi bùa (`2700` tick).
   3. Di chuyển Mây (chạy `6.0`/`7.2` m/s, nhảy `vy=7.0, g=-20`, lướt `14 m/s` trong `12` tick, bục nhảy, gió Đêm 3) và kiểm tra rơi khỏi đảo (`Y < -10`).
   4. Nhặt đom đóm và Bùa Gió (`XZ <= 1.0 m`, `|dY| <= 1.5 m`).
   5. Tương tác nạp đèn (`XZ <= 2.0 m`, chi phí `10`, `+10` điểm/đom đóm nạp, `+100` điểm/đèn thắp).
   6. Cập nhật vùng an toàn (`safe_radius = 6.0 m`, đẩy Bóng Mực bên trong ra mép trong tối đa 30 tick).
   7. Tỏa Sáng (`pulse`: tốn `3` đom đóm, tâm `chân Mây + 0.8 m`, khoảng cách 3D `<= 5.0 m`, choáng `120` tick, đẩy `4 m` trong `15` tick đầu, `+5` điểm/Bóng Mực; Gió Lạc trúng thì `flee` hoặc thả lại đồ `drifter_drop`).
   8. Di chuyển Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`) và Gió Lạc (`idle`, `chase`, `flee`, `removed`).
   9. Va chạm: Gió Lạc cướp trước (`XZ <= 1.2 m`, `drifter_steal`), Bóng Mực đánh sau (`XZ <= 1.0 m, |dY| <= 1.5 m`, xét theo ID tăng dần).
   10. Sinh đom đóm (mỗi `240` tick, trần `30`), Bóng Mực (tick `300 + interval*k`), Gió Lạc (tick `1200, 2400...` ở Đêm 2 & 3) — chỉ tương tác từ tick sau.
   11. Xét thắng/thua theo thứ tự: `no_flames` → `all_lit` (`+ floor(time_left_s)*2 + 50*flames`) → `dawn`.
   12. Ghi snapshot nếu `tick % snapshot_every == 0`.
3. **Quy ước góc bản đồ:** Góc đo từ trục `+X`, ngược chiều kim đồng hồ trên mặt phẳng XZ (`x = r*cos(θ), z = r*sin(θ)`).

## 3. Quy tắc kiểm chứng & Git
- Chạy `python3 -m unittest discover -s tests` trước mọi commit (cưỡng chế bởi `.githooks/pre-commit`).
- Khi yêu cầu Phase 2 thay đổi thông số Phase 1, cập nhật test cũ kèm chú thích rõ lý do trong code và tài liệu.
