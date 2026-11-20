---
name: verify-phase
description: Quy trình tự động kiểm chứng Test Contract, tính tất định (determinism), mã thoát lỗi và thu thập bằng chứng cho từng phase của Đảo Đèn Lồng.
---

# Skill: Kiểm chứng Phase & Thu thập Bằng chứng (`verify-phase`)

Sử dụng skill này trước khi kết thúc một phase hoặc trước khi gắn tag `phase-N`.

## Các bước thực hiện

1. **Kiểm tra cú pháp (`build_cmd`):**
   ```bash
   python3 -m py_compile headless.py run_game.py src/sim.py
   ```
2. **Chạy Unit Tests & Scenario Tests:**
   ```bash
   python3 -m unittest discover -s tests -v
   ```
3. **Kiểm tra tính tất định (Determinism Check):**
   Chạy 2 lần cùng `--seed`, `--scenario`, `--inputs` và so sánh mã băm SHA-256:
   ```bash
   python3 headless.py --seed 42 --night 1 --ticks 600 --out /tmp/run1.jsonl
   python3 headless.py --seed 42 --night 1 --ticks 600 --out /tmp/run2.jsonl
   sha256sum /tmp/run1.jsonl /tmp/run2.jsonl
   ```
4. **Lưu bằng chứng vào `docs/proof/phaseN/`:**
   - Lưu log kết quả test, file `.jsonl` mẫu của các scenario và ảnh chụp màn hình 3D.
   - Cập nhật bảng truy vết yêu cầu → bằng chứng.
