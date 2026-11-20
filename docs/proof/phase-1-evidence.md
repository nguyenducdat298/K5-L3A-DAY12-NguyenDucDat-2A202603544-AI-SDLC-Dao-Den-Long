# Bằng chứng kiểm chứng Phase 1

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` đúng chuẩn v1.0 | Đọc & chạy `headless_cmd` qua `test_contract.py` | [game.contract.json](../../game.contract.json) | Đạt |
| Headless CLI 60 tick/s, snapshot/event/end JSONL | `uv run python -m src.headless --seed 42 --night 1 --ticks 300 --out /tmp/phase1_smoke.jsonl` | Tick 0..300 đủ snapshot & `{"type":"end","ticks":300,"state":"playing","score":0}` | Đạt |
| Tính tất định (cùng seed/scenario/inputs -> output giống hệt) | `test_determinism_identical_output` | `Ran 7 tests in 0.970s - OK` | Đạt |
| Nhặt đom đóm, nạp đèn, thắp đèn, thắng (`all_lit`) | `test_pickup_deposit_and_win` | `mote_picked` x3, `deposit`, `lantern_lit`, `state == "won"` | Đạt |
| `pulse` làm choáng & đẩy lùi Bóng Mực | `test_pulse_stuns_and_pushes_shade` | `stunned_ids == ["S1"]`, `state == "stunned"` | Đạt |
| `safe_radius` chặn Bóng Mực quanh đèn đã thắp | `test_safe_radius_blocks_shade` | Khoảng cách shade >= `4.5m`, `flames == 3` | Đạt |
| Mất hết máu (`no_flames`) & hết giờ (`dawn`) | `test_shade_hit_and_no_flames_loss`, `test_dawn_loss` | `state == "lost"` với đúng `reason` | Đạt |
| Sai định dạng `inputs` trả mã thoát `2` | `test_malformed_inputs_exit_2` | `returncode == 2` | Đạt |
| Client 3D + HUD khởi tạo không lỗi | `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy uv run python -c "... _render_hud_surface ..."` | `HUD surface ok: (1120, 700)` | Đạt |

## 2. Lệnh tự chạy lại ở tag `phase-1`

```bash
uv sync
uv run python -m unittest discover -s tests -v
uv run python -m src.headless --seed 42 --night 1 --ticks 300 --out /tmp/phase1_smoke.jsonl
```
