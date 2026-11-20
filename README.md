# Đảo Đèn Lồng — Day 12 AI SDLC (3D Anime Edition)

> **Học viên:** Nguyễn Đức Đạt · **MSSV:** `2A202603544` · **Lớp:** `L3A`
> **Phiên bản hiện tại:** `phase-1` (PRD-0 & Test Contract v1.0)

Game 3D góc nhìn thứ ba phong cách **Anime Cel-Shading** (Three.js + Anime.js) kết hợp lõi mô phỏng **60 tick/giây tất định (Deterministic Headless Core)** bằng Python 3 Standard Library.

![Gameplay 3D Anime](docs/proof/phase1/03_lantern_lit_anime_banner.png)

---

## 1. Cài đặt và Chạy (Tối đa 3 lệnh)

Dự án **không yêu cầu cài thêm thư viện ngoài** (`0 pip install`, `0 npm install` — `Three.js` và `Anime.js` đã được đóng gói sẵn trong `web/vendor/`). Chỉ cần `python3` (có sẵn trên macOS và Linux):

```bash
# 1. Kiểm tra biên dịch / cú pháp (build_cmd)
python3 -m py_compile headless.py run_game.py src/sim.py

# 2. Chạy bộ kiểm thử tự động (Unit + Scenario + Determinism + Exit Code)
python3 -m unittest discover -s tests -v

# 3. Mở game 3D trên trình duyệt (run_cmd)
python3 run_game.py
```

### Chạy chế độ Headless (Test Contract v1.0)

```bash
python3 headless.py --seed 7 --night 1 \
  --scenario tests/scenarios/win_all_lit_scenario.json \
  --inputs tests/scenarios/win_all_lit_inputs.json \
  --ticks 300 --out /tmp/out.jsonl --snapshot-every 10
```

---

## 2. Điều khiển trong Game 3D

| Phím / Thao tác | Chức năng |
|---|---|
| `W A S D` hoặc `↑ ↓ ← →` | Di chuyển Mây trên Đảo Bến |
| `Space` | Nhảy |
| `F` hoặc `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong `interact_radius = 2.5m`) |
| `R` hoặc `Shift` | **Tỏa Sáng (Pulse)** — tốn `1` đom đóm, đẩy lùi `4m` và làm choáng Bóng Mực trong `6m` suốt `3s` |
| `Q` / `C` hoặc **Kéo chuột** | Xoay góc nhìn Camera 3D quanh Mây (`cam_yaw_deg`) |
| Nút `🤖 Tự Chơi (Demo)` | Bật/tắt AI điều khiển Mây tự động gom đom đóm, né Bóng Mực và thắp đèn |
| Nút `↻ Chơi Lại` | Khởi động lại màn Đêm 1 bất cứ lúc nào hoặc sau khi Thắng/Thua |

---

## 3. Cách Tính Điểm & Giải thích `tuning` (`game.contract.json`)

- **Nhặt đom đóm (`mote_picked`):** `+10 điểm` / đom đóm (`score.per_mote = 10`). Tối đa mang `carry_capacity = 5`.
- **Thắp sáng Đèn Lồng Lớn (`lantern_lit`):** `+100 điểm` / đèn (`score.per_lantern = 100`). Mỗi đèn cần `lantern_cost = 3` đom đóm.
- **Tỏa sáng làm choáng Bóng Mực (`pulse`):** `+25 điểm` / mỗi Bóng Mực bị choáng (`score.per_stun = 25`).
- **Thưởng Chiến thắng (`all_lit` — khi thắp đủ 5 đèn):**
  - Thời gian còn lại: `round(time_left_s * 2)` (`score.per_second_left = 2`).
  - Lửa sinh mệnh còn lại: `flames * 100` (`score.per_flame_left = 100`).
  - *(Khi thua do `no_flames` hoặc `dawn`, không cộng điểm thưởng cuối màn).*
- **`fall_enabled: false`:** Đêm 1 không phạt rơi khỏi đảo, đảm bảo các kịch bản kiểm thử tọa độ xa trong `headless.py` không bị giới hạn cứng.

---

## 4. Sáng tạo của tôi (Hạng mục F)

Các yếu tố sáng tạo được đặt **100% ở tầng hiển thị và âm thanh (`web/`)**, tách biệt hoàn toàn khỏi lõi mô phỏng `src/sim.py` và `headless.py` nên **không làm thay đổi bất kỳ dòng đầu ra JSONL nào của Test Contract**:

1. **Đồ họa 3D Anime Cel-Shading & Viền mực (Inverted-Hull Outlines):**
   - Sử dụng `THREE.MeshToonMaterial` với `DataTexture` 4 dải sắc độ (`NearestFilter`) kết hợp lớp mesh viền `THREE.BackSide` tạo nét vẽ Anime rõ ràng cho Mây (đội nón lá treo đèn lồng nhỏ, khăn quàng đỏ), 5 Đèn Lồng Lớn và Bóng Mực (mắt tím phát sáng, vòng sao choáng quay trên đầu khi trúng `pulse`).
2. **Đèn lồng nón lá & Bầu khí quyển Đảo Bến biến chuyển động:**
   - Độ sáng và bán kính đèn lồng nhỏ trên nón lá của Mây tăng theo số đom đóm đang mang (`carried / 5`).
   - Khi từng Đèn Lồng Lớn được thắp sáng (`0/5 -> 5/5`), sương đen (`FogExp2`) lùi xa dần và bầu trời chuyển từ tím mực sang xanh đêm ấm áp giữa Biển Mây.
3. **Hoạt ảnh Giao diện & Banner bằng `Anime.js`:**
   - Màn hình giới thiệu Tập 1 dùng `Anime.js` vẽ nét SVG đèn lồng (`strokeDashoffset`) và hiệu ứng `anime.stagger`.
   - Khi thắp đèn hoặc tỏa sáng, `anime.timeline()` kích hoạt banner thư pháp, sóng ánh sáng lan tỏa và hiệu ứng nảy lò xo (`spring(1, 80, 10, 0)`) trên HUD.
4. **Âm thanh Procedural bằng Web Audio API (`web/audio.js` — 0KB asset ngoài):**
   - Tự tổng hợp tiếng chuông gió ngũ cung (pentatonic kalimba) cao độ tăng dần theo số đom đóm nhặt được, tiếng chuông đền ấm áp khi thắp đèn và sóng âm khi `pulse`.
5. **Chế độ AI Tự Chơi (`🤖 Tự Chơi Demo`) trên HUD:**
   - Cho phép quan sát Mây tự động tìm đường gom đom đóm, kích hoạt `pulse` khi Bóng Mực áp sát và thắp đủ 5 đèn.

> **Bằng chứng phần lõi không bị ảnh hưởng:** Toàn bộ 8/8 bài test trong `tests/test_contract_phase1.py` và kiểm tra tính tất định SHA-256 trong [docs/proof/phase1/PROOF.md](docs/proof/phase1/PROOF.md) đều đạt 100%.

---

## 5. Hồ sơ AI SDLC, Bằng chứng & Tài liệu

- [AGENTS.md](AGENTS.md) — Hướng dẫn cố định cho AI Agent.
- [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) — Skill tự động hóa kiểm chứng Phase.
- [.githooks/pre-commit](.githooks/pre-commit) — Git hook chặn commit khi cú pháp hoặc test lỗi.
- [docs/notes/phase1-spec-and-assumptions.md](docs/notes/phase1-spec-and-assumptions.md) — Đặc tả yêu cầu, tiêu chí nghiệm thu và giả định Phase 1.
- [docs/notes/ai-log.md](docs/notes/ai-log.md) — Nhật ký dùng AI, phân tích lỗi và ước tính token.
- [docs/proof/phase1/PROOF.md](docs/proof/phase1/PROOF.md) — Bảng truy vết bằng chứng, output JSONL, mã băm SHA-256 và ảnh chụp 3D.
- [CREDITS.md](CREDITS.md) & [LICENSE](LICENSE) — Nguồn thư viện mã nguồn mở và giấy phép MIT.
