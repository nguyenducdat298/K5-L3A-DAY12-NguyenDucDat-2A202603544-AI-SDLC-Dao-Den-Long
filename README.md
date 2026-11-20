# Đảo Đèn Lồng — Day 12 AI SDLC (Phase 1)

Game 3D góc nhìn thứ ba: điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) thu thập đom đóm để thắp sáng 5 Đèn Lồng Lớn trên **Đêm 1 – Đảo Bến**, dùng ánh sáng xua Bóng Mực trước khi hết ngọn lửa hoặc bình minh tới.

---

## Cài đặt & Chạy (tối đa 3 lệnh)

Yêu cầu: Python 3.12+ và [`uv`](https://docs.astral.sh/uv/).

```bash
uv sync
uv run python -m src.client.app
```

Chạy kiểm thử tự động:

```bash
uv run python -m unittest discover -s tests -v
```

Chạy chế độ **headless** (Test Contract v1.0):

```bash
uv run python -m src.headless --seed 42 --night 1 --ticks 300 --out out.jsonl
```

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W A S D` | Di chuyển theo hướng camera |
| `←` / `→` hoặc giữ chuột trái kéo | Xoay camera quanh Mây |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn (`interact`) |
| `F` hoặc chuột phải | Tỏa sáng xua Bóng Mực (`pulse`) |
| `R` / `Enter` | Chơi lại sau khi thắng hoặc thua |

---

## Cách tính điểm

Cấu hình chi tiết trong [game.contract.json](game.contract.json):
- Nhặt 1 đom đóm: `+10`
- Thắp sáng 1 Đèn Lồng Lớn (cần 3 đom đóm): `+100`
- Làm choáng 1 Bóng Mực bằng `pulse`: `+25`
- Thưởng khi **thắng** (`all_lit`): `+5` / giây còn lại và `+50` / ngọn lửa còn lại.

---

## Sáng tạo của tôi

Toàn bộ phần sáng tạo nằm ở lớp hiển thị & âm thanh (`src/client/`), **không** ảnh hưởng tới lõi `src/core/sim.py` và đầu ra `headless`:
1. **Ánh sáng & Sương mù động:** Màu trời tím đen và độ dày sương mù (`GL_EXP2`) ấm dần và lùi xa theo tỷ lệ số Đèn Lồng Lớn đã thắp.
2. **Mây & Nón lá đèn lồng:** Kích thước và độ sáng chiếc đèn lồng treo trước nón lá của Mây tăng theo số đom đóm đang mang (`carried`), kèm vòng sóng ánh sáng lan tỏa khi `pulse`.
3. **Âm thanh Procedural (0KB asset):** Tổng hợp hiệu ứng âm thanh (nhặt đom đóm, nạp đèn, thắp đèn, pulse, trúng đòn) trực tiếp bằng `math` + `pygame.mixer` trong `src/client/audio.py`.
4. **Dẫn truyện ngắn:** Lời dẫn cổ tích ở màn mở đầu và màn kết thúc.

---

## Tài liệu & Ghi chép Lab
- Harness AI: [AGENTS.md](AGENTS.md)
- Thiết kế Phase 1: [docs/superpowers/specs/2026-11-20-phase1-design.md](docs/superpowers/specs/2026-11-20-phase1-design.md)
- Ghi chép & Giả định Phase 1: [docs/notes/phase-1-notes.md](docs/notes/phase-1-notes.md)
- Bằng chứng kiểm chứng Phase 1: [docs/proof/phase-1-evidence.md](docs/proof/phase-1-evidence.md)
- Tài liệu gốc của bài lab: [GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md), [RUBRIC.md](RUBRIC.md)
