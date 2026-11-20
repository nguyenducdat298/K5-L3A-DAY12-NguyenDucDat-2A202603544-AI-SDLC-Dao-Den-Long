---
name: verify-phase
description: Quy trình tự động kiểm chứng Test Contract (v1.0/v1.1), tính tất định (determinism), hiệu năng 21.600 tick <= 30s, mã thoát lỗi và thu thập bằng chứng cho Đảo Đèn Lồng.
---

# Skill: Kiểm chứng Phase & Thu thập Bằng chứng (`verify-phase`)

Sử dụng skill này trước khi kết thúc một phase hoặc trước khi gắn tag `phase-N`.

## Các bước thực hiện (Cập nhật Phase 2 — Contract v1.1)

1. **Kiểm tra cú pháp (`build_cmd`):**
   ```bash
   python3 -m py_compile headless.py run_game.py src/sim.py
   ```
2. **Chạy Unit Tests & Scenario Tests (Đêm 1, 2, 3):**
   ```bash
   python3 -m unittest discover -s tests -v
   ```
3. **Kiểm tra Tính tất định (Determinism) & Hiệu năng 21.600 tick (≤ 30s):**
   ```bash
   time python3 headless.py --seed 42 --night 3 --ticks 21600 --out /tmp/n3_run1.jsonl --snapshot-every 60
   python3 headless.py --seed 42 --night 3 --ticks 21600 --out /tmp/n3_run2.jsonl --snapshot-every 60
   sha256sum /tmp/n3_run1.jsonl /tmp/n3_run2.jsonl
   ```
4. **Kiểm tra Giao diện 3D & FPS (≥ 30 FPS ở 1280×720):**
   - Dùng Playwright Firefox mở 3 Đêm, đo FPS thực tế, kiểm tra 0 lỗi console và chụp ảnh màn hình lưu vào `docs/proof/phase2/`.
