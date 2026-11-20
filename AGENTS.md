# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

Tài liệu hướng dẫn cố định cho AI Agent trong dự án **Đảo Đèn Lồng**. Giữ ngắn gọn để tiết kiệm context token.

## 1. Lệnh chuẩn của dự án
- **Build / Kiểm tra cú pháp:** `python3 -m py_compile headless.py run_game.py src/sim.py`
- **Chạy game 3D (có giao diện):** `python3 run_game.py`
- **Chạy chế độ Headless (Test Contract):**
  `python3 headless.py --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]`
- **Chạy toàn bộ bộ kiểm thử tự động:** `python3 -m unittest discover -s tests -v`

## 2. Quy tắc kiến trúc bắt buộc
1. **Tách biệt tuyệt đối Core Logic và 3D View:**
   - `src/sim.py` và `headless.py` chỉ dùng Python 3 standard library (`json`, `math`, `argparse`, `sys`), **không** phụ thuộc cửa sổ hay GPU.
   - Mọi thông số gameplay phải đọc động từ `game.contract.json` (`tuning`), tuyệt đối không hardcode số khác với `game.contract.json`.
2. **Tuân thủ chặt Test Contract v1.0:**
   - 60 tick/giây cố định (`dt = 1/60`). Snapshot `tick = 0` ghi sau khi dựng scenario và trước khi áp dụng input.
   - Bước `k` (`k = 0..N-1`) đọc input ở `tick = k`, sinh trạng thái và event ở `tick = k + 1`.
   - Khoảng cách đo trên mặt phẳng ngang `XZ` (`math.hypot(dx, dz) <= r + 1e-9`).
   - Tọa độ xuất ra JSONL làm tròn 3 chữ số thập phân.
   - Tính tất định (Determinism): chỉ dùng seeded PRNG (`Mulberry32`), cấm dùng `random.random()` không seed.
   - Mã thoát CLI: `0` khi thành công, `2` khi file `--inputs` hoặc `--scenario` sai định dạng (kèm thông báo ra `stderr`).
3. **Sáng tạo không phá Contract:**
   - Các yếu tố sáng tạo (đồ họa Anime Cel-shading, hiệu ứng Anime.js, âm thanh Web Audio API, hạt sáng, dẫn truyện) chỉ nằm ở tầng hiển thị `web/`, không làm thay đổi kết quả `headless.py`.

## 3. Quy tắc kiểm chứng & Git
- Chạy `python3 -m unittest discover -s tests` trước mọi commit (được cưỡng chế bởi `.githooks/pre-commit`).
- Commit nhỏ theo từng bước, message rõ ràng. Không commit `.env`, API key hoặc token.
