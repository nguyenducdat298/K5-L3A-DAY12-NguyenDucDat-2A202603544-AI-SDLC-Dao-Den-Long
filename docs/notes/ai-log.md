# Nhật ký sử dụng AI & Quản lý Token (AI Usage Log)

## Phase 1 — PRD-0 & Test Contract v1.0

### 1. Cách điều phối AI & Harness đã dùng
- **Subagent `prd-analyst`:** Tách riêng một subagent chỉ đọc (read-only) để rà soát toàn bộ PRD-0 và Test Contract v1.0 trước khi viết dòng code đầu tiên, giúp phát hiện sớm 12 điểm biên (edge-cases) mà không làm phình ngữ cảnh của phiên chính.
- **`AGENTS.md`:** Giữ gọn (~35 dòng) chứa đúng lệnh `build_cmd`, `run_cmd`, `headless_cmd`, lệnh chạy `unittest` và quy tắc tách biệt `src/sim.py` khỏi `web/`.
- **Skill `.agents/skills/verify-phase/SKILL.md`:** Chuẩn hóa quy trình 4 bước kiểm chứng (cú pháp → unit/scenario test → kiểm tra tính tất định SHA-256 → lưu bằng chứng).
- **Git Hook `.githooks/pre-commit`:** Tự động chạy `py_compile` và `python3 -m unittest discover -s tests` trước mỗi lần `git commit`.

### 2. Các lỗi / Rủi ro đã phát hiện & Cách khắc phục bằng Harness
| Tình huống / Lỗi phát hiện | Cách phát hiện | Cách xử lý & Cập nhật Harness |
|---|---|---|
| **Sai lệch môi trường runtime (`node` không có sẵn trong `/usr/bin`)** | Kiểm tra môi trường đầu Phase 1 (`node: command not found`) | Chuyển `headless_cmd`, `build_cmd`, `run_cmd` sang **Python 3 Standard Library** (`python3 headless.py`, `python3 run_game.py`) và đóng gói sẵn `three.module.min.js` + `anime.es.js` trong `web/vendor/` để chạy 100% độc lập không cần `npm install`. |
| **Pre-commit hook chặn commit đầu tiên khi chưa có file test (`NO TESTS RAN` trả mã lỗi 5 trên Python 3.14)** | Hook `.githooks/pre-commit` chặn ngay ở commit đầu tiên | Cập nhật `.githooks/pre-commit` kiểm tra sự tồn tại của `tests/test_*.py` trước khi gọi `unittest`, đồng thời dùng `git rm --cached` và `.gitignore` để loại bỏ `__pycache__`. |
| **Rủi ro kẹp bán kính đảo khi `fall_enabled: false` làm hỏng kịch bản tọa độ xa của giảng viên** | Phân tích ví dụ Section D (`lanterns` ở `z=25`, `shades` ở `x=30.1`) | Trong `src/sim.py` (chế độ headless), khi `fall_enabled: false`, không kẹp cứng tọa độ nhân vật để mọi kịch bản test tự động đều đi tới đúng tọa độ `player_speed * t`. |
| **Sai số dấu phẩy động IEEE-754 ở biên bán kính (`dist <= r`)** | Phân tích `6.0 * (1/60) * 120` trong hệ nhị phân | Thêm dung sai `EPS = 1e-9` cho mọi phép so sánh khoảng cách `dist_xz(a, b) <= r + EPS` và làm tròn `round3()` khi xuất JSONL. |

### 3. Ước tính Token & Chiến lược Tiết kiệm Token (Phase 1)
- **Ước tính lượng token sử dụng ở Phase 1:**
  - Phiên phân tích (`prd-analyst` subagent): ~6.500 input tokens / ~1.800 output tokens.
  - Phiên triển khai chính (Harness + Core Sim + Tests + 3D Anime Web Client + Verification): ~28.000 input tokens / ~9.500 output tokens.
  - **Tổng cộng Phase 1:** ~45.800 tokens (chi phí ước tính ~$0.22 USD).
- **Cách tiết kiệm token đã áp dụng:**
  1. **Viết spec và test trước khi code giao diện 3D:** `src/sim.py` và `tests/test_contract_phase1.py` pass 8/8 test ngay lần chạy đầu tiên (0 vòng debug lặp lại).
  2. **Giao việc phân tích PRD cho subagent riêng:** Chỉ nhận về bảng tổng hợp ngắn gọn thay vì nhồi toàn bộ suy luận vào context chính.
  3. **Dùng Procedural 3D & Procedural Web Audio:** Không tốn lượt gọi tool tìm/tải/chuyển đổi asset 3D hay âm thanh bên ngoài.
