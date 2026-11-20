# Đảo Đèn Lồng — Day 12 AI SDLC (3D Anime Edition · Phase 3 · Contract v1.2)

> **Học viên:** Nguyễn Đức Đạt · **MSSV:** `2A202603544` · **Lớp:** `L3A`
> **Phiên bản hiện tại:** `phase-3` (TICKET-03 — Change Request "Đèn cạn dầu" & Test Contract v1.2)

Game 3D góc nhìn thứ nhất / thứ ba phong cách **Anime Cel-Shading** (Three.js + Anime.js) qua **3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông)** kết hợp lõi mô phỏng **60 tick/giây tất định (Deterministic Headless Core)** bằng Python 3 Standard Library.

![Đêm 3 Đảo Chuông](docs/proof/phase3/02_lantern_fuel_bar_and_squashed_unlit.png)

---

## 1. Cài đặt và Chạy (Tối đa 3 lệnh)

Dự án **không yêu cầu cài thêm thư viện ngoài** (`0 pip install`, `0 npm install`). Chỉ cần `python3` (có sẵn trên macOS và Linux):

```bash
# 1. Kiểm tra biên dịch / cú pháp (build_cmd)
python3 -m py_compile headless.py run_game.py src/sim.py

# 2. Chạy bộ kiểm thử tự động (22 tests: Phase 1 + Phase 2 + Phase 3 Contract v1.2 + Hiệu năng 21.600 tick)
python3 -m unittest discover -s tests -v

# 3. Mở game 3D trên trình duyệt (run_cmd)
python3 run_game.py
```

### Chạy chế độ Headless (Test Contract v1.2 — Hỗ trợ `--night 1`, `2`, `3`)

```bash
python3 headless.py --seed 42 --night 1 --ticks 14400 --out /tmp/night1_p3.jsonl --snapshot-every 60
```

---

## 2. Điều khiển trong Game 3D (First-Person FPS & Third-Person TPS + Pointer Lock)

| Phím / Thao tác | Chức năng |
|---|---|
| **Click vào màn hình 3D** | **Khóa con trỏ chuột ở giữa màn hình (`Pointer Lock` / `CursorLockMode.Locked`)** để xoay góc nhìn tự do |
| `V` hoặc nút `🎥 Góc Nhìn` | Chuyển đổi **First-Person (FPS — Cầm Quang Tiễn)** ↔ **Third-Person (TPS — Xem Mây chạy bộ & Lướt Gió)** |
| `Chuột Trái` hoặc `B` | **Bắn Quang Tiễn** — tiêu hao 1 viên đạn ánh sáng trong băng (`25` viên/băng), bắn tia sáng 3D làm choáng & đẩy lùi Bóng Mực |
| `G` | **Thay Hộp Năng Lượng** — hoạt ảnh tháo/lắp băng đạn cong bằng `Anime.js` (nhặt thêm **Hộp Năng Lượng** phát sáng trên sàn đấu `+25` viên) |
| `W A S D` hoặc `↑ ↓ ← →` | Di chuyển **Mây** (`6.0 m/s`, tăng lên `7.2 m/s` khi có **Bùa Gió**) kèm **Animation chạy bộ (Run Cycle)** |
| `Space` | Nhảy (`vy = 7.0 m/s`, trọng lực `-20 m/s²`) |
| `Shift` | **Lướt Gió (`Wind Dash`)** — `14 m/s` trong `0.2s` (`12` tick), xoay người 360° kèm vòng xoáy gió, vệt tàn ảnh (afterimage) & speed-lines |
| `E` hoặc `F` | **Thắp đèn / Châm thêm dầu (`Refuel`)** vào Đèn Lồng Lớn gần nhất (`<= 2.0m`, thắp đầu `10`, thắp lại `5`, châm dầu `+10 fuel`/đom đóm) |
| `R` | **Tỏa Sáng (`Pulse`)** — tốn `3` đom đóm, bán kính 3D `5m`, hồi chiêu `3s`, làm choáng Bóng Mực `120` tick & đẩy lùi `4m` (`+15` điểm nếu ngắt Bóng đang hút dầu) |
| `Esc` hoặc `P` | **Tạm dừng (`Pause`) & Mở khóa chuột** — dừng toàn bộ logic, mở menu Tiếp tục / Chơi lại / Cài đặt (Bảng màu dễ phân biệt) / Về Menu |
| `Q` / `C` hoặc **Di chuột** | Xoay góc nhìn Camera 3D (`cam_yaw_deg` & `fpsPitch`) |

---

## 3. Luật Cốt Lõi Mới Phase 3 — "Đèn cạn dầu" (TICKET-03 · Contract v1.2)

- **Nhiên liệu đèn (`fuel_max = 100`) & Châm dầu (`refuel`):**
  - Khi vừa thắp (lần đầu hoặc thắp lại), `fuel = 100`. Đèn đang sáng tự hao `1.0 fuel/giây` (`1/60` mỗi tick, lưu chính xác bằng số nguyên `fuel_ticks`).
  - Bấm `E`/`F` cạnh đèn đang sáng nhưng chưa đầy dầu để châm thêm: `used = min(carried, ceil((100 - fuel) / 10))`, mỗi đom đóm hồi `+10 fuel` (`+5` điểm/đom đóm).
  - Khi `fuel <= 0`: đèn tắt (`lantern_out`), nhớ `ever_lit = true`. Thắp lại đèn đã từng sáng (`ever_lit`) chỉ tốn **`5` đom đóm** (`+40` điểm, tăng `relit_count`).
- **Bóng Mực hút dầu (`drain` state):**
  - Đèn có `fuel < 30` **mất vùng an toàn 6m** (đúng `30.0` vẫn còn vùng an toàn) và nhấp nháy cảnh báo ở tần số `1 Hz`.
  - Bóng Mực ở trạng thái `wander` ưu tiên tìm đèn đang sáng có `fuel < 30` gần nhất; khi áp sát `<= 2.0m` (XZ) sẽ chuyển sang `drain`, đứng yên hút `5.0 fuel/giây` (`5/60` mỗi tick, cộng dồn nhiều con) và phát sự kiện `fuel_drain` mỗi `60` tick.
- **Điều kiện Thắng/Thua mới ("Giữ đảo sáng tới bình minh"):**
  - Thời lượng Đêm rút gọn để giữ nhịp căng thẳng: **Đêm 1: `240s`**, **Đêm 2: `270s`**, **Đêm 3: `300s`**.
  - Thắp hết đèn **không thắng ngay**. Khi hết giờ (`time_left_s <= 0`), nếu Mây còn sống và số đèn đang sáng `>= ceil(0.6 * tổng_đèn)` (**Đêm 1: `>= 3/5`**, **Đêm 2: `>= 4/6`**, **Đêm 3: `>= 5/7`**) → Thắng (`reason: "dawn_survived"`). Ngược lại → Thua (`reason: "dawn"`).
- **Sức chứa động (`player.capacity`) & Điểm số v1.2:**
  - `capacity = min(20, 10 + 2 * số_lần_thắp_thành_công)` (tính cả thắp lần đầu và thắp lại).
  - Nạp/châm dầu: `+5`/đom đóm · Thắp lần đầu: `+100` · Thắp lại: `+40` · Choáng thường: `+5` · Choáng Bóng đang `drain`: `+15` · Thưởng bình minh: `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi lửa sinh mệnh còn lại.
- **Khả năng tiếp cận — Bảng màu dễ phân biệt (`Colorblind Mode`):**
  - Bật trong **Cài đặt** (lưu `localStorage`): đổi viền/mắt Bóng Mực sang xanh lam sáng `#00B3FF`, cảnh báo nguy hiểm sang `#FFFFFF` kèm biểu tượng `⚠`, đèn tắt có dáng lùn đi `20%` kèm vết rách giấy để phân biệt bằng hình dạng.

---

## 4. Sáng tạo của tôi (Hạng mục F — Tích hợp đầy đủ qua Phase 1, 2 & 3)

Toàn bộ phần sáng tạo nằm ở tầng hiển thị/âm thanh `web/`, **không làm thay đổi bất kỳ dòng đầu ra JSONL nào của `headless.py`**:

1. **Chế độ First-Person (FPS) & Quang Tiễn + Khóa Chuột (`Pointer Lock`) + Hộp Năng Lượng trên sàn đấu:**
   - Click vào màn hình tự động khóa chuột ở tâm ngắm (`requestPointerLock`), hỗ trợ chuyển đổi linh hoạt FPS ↔ TPS bằng phím `[V]`.
   - Khẩu **Quang Tiễn** 3D có lửa đầu nòng (muzzle flash), đường đạn ánh sáng tracer 3D, hitmarker khi bắn trúng Bóng Mực, hoạt ảnh tháo/lắp băng đạn cong (`[G]`) bằng `Anime.js`, và các **Hộp Năng Lượng** phát sáng trên sàn đấu (`+25` viên đạn dự trữ).
2. **Model 3D Nhân vật Khớp Xương + Animation Chạy bộ & Lướt Gió (`Wind Dash`):**
   - Nhân vật 3D phân cấp khớp xương (`torsoPivot`, `headPivot`, `leftArmPivot`, `rightArmPivot`, `leftLegPivot`, `rightLegPivot`, tà áo & đuôi tóc động) với hoạt ảnh chạy bộ so le và cú **Lướt Gió** xoay 360° kèm vòng xoáy gió (`dashWindRing`) + bóng tàn ảnh (afterimage).
3. **Tinh thể Đom Đóm Đa Diện, Ông Đăng, Đàn Cá Mây & Web Audio API Synthesizer:**
   - Đom đóm hình tinh thể đa diện kèm vòng quỹ đạo xoay quanh; **Ông Đăng** dẫn truyện ở quảng trường xuất phát; đàn **Cá Mây** bơi dưới Biển Mây; nhạc nền ngũ cung và bộ 14 hiệu ứng âm thanh tổng hợp trực tiếp bằng Web Audio API.

> **Bằng chứng phần lõi không bị ảnh hưởng:** Toàn bộ **22/22 bài test** trong `tests/test_contract_phase1.py`, `tests/test_contract_phase2.py`, `tests/test_contract_phase3.py` đều đạt 100% trong `< 0.7 giây` (xem [docs/proof/phase3/PROOF.md](docs/proof/phase3/PROOF.md)).

---

## 5. Hồ sơ AI SDLC, ADR, Changelog & Bằng chứng

- [CHANGELOG.md](CHANGELOG.md) — Danh sách đầy đủ các thay đổi phá vỡ tương thích (`Breaking Changes`) từ `v1.0 → v1.1 → v1.2`.
- [docs/notes/phase3-adr-and-spec.md](docs/notes/phase3-adr-and-spec.md) — **ADR-03** (Quyết định kiến trúc cho Change Request "Đèn cạn dầu") & tiêu chí nghiệm thu `P3-01..P3-06`.
- [AGENTS.md](AGENTS.md) — Hướng dẫn cố định cho AI Agent (cập nhật Contract v1.2).
- [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) & [.githooks/pre-commit](.githooks/pre-commit) — Skill kiểm chứng và Git hook tự động.
- [docs/notes/ai-log.md](docs/notes/ai-log.md) — Nhật ký dùng AI, phân tích lỗi và ước tính token qua cả 3 Phase.
- [docs/proof/phase1/PROOF.md](docs/proof/phase1/PROOF.md), [docs/proof/phase2/PROOF.md](docs/proof/phase2/PROOF.md) & [docs/proof/phase3/PROOF.md](docs/proof/phase3/PROOF.md) — Bằng chứng thực thi, output JSONL, SHA-256 determinism và ảnh chụp 3D.
- [CREDITS.md](CREDITS.md) & [LICENSE](LICENSE) — Nguồn thư viện mã nguồn mở và giấy phép MIT.
