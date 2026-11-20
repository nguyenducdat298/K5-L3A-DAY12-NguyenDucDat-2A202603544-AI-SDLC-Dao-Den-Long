# Đảo Đèn Lồng — Day 12 AI SDLC (3D Anime Edition · Phase 2 · Contract v1.1)

> **Học viên:** Nguyễn Đức Đạt · **MSSV:** `2A202603544` · **Lớp:** `L3A`
> **Phiên bản hiện tại:** `phase-2` (TICKET-02 — "Ba hòn đảo" & Test Contract v1.1)

Game 3D góc nhìn thứ ba phong cách **Anime Cel-Shading** (Three.js + Anime.js) qua **3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông)** kết hợp lõi mô phỏng **60 tick/giây tất định (Deterministic Headless Core)** bằng Python 3 Standard Library.

![Đêm 3 Đảo Chuông](docs/proof/phase2/04_night3_dao_chuong_3tiers_bell_tower.png)

---

## 1. Cài đặt và Chạy (Tối đa 3 lệnh)

Dự án **không yêu cầu cài thêm thư viện ngoài** (`0 pip install`, `0 npm install`). Chỉ cần `python3` (có sẵn trên macOS và Linux):

```bash
# 1. Kiểm tra biên dịch / cú pháp (build_cmd)
python3 -m py_compile headless.py run_game.py src/sim.py

# 2. Chạy bộ kiểm thử tự động (17 tests: Regression Phase 1 + Tính năng mới Phase 2 + Hiệu năng 21.600 tick)
python3 -m unittest discover -s tests -v

# 3. Mở game 3D trên trình duyệt (run_cmd)
python3 run_game.py
```

### Chạy chế độ Headless (Test Contract v1.1 — Hỗ trợ `--night 1`, `2`, `3`)

```bash
python3 headless.py --seed 42 --night 3 --ticks 21600 --out /tmp/night3.jsonl --snapshot-every 60
```

---

## 2. Điều khiển trong Game 3D

| Phím / Thao tác | Chức năng |
|---|---|
| `W A S D` hoặc `↑ ↓ ← →` | Di chuyển Mây (`6.0 m/s`, tăng lên `7.2 m/s` khi có **Bùa Gió**) |
| `Space` | Nhảy (`vy = 7.0 m/s`, trọng lực `-20 m/s²`) |
| `Shift` | **Lướt (`Dash`)** — `14 m/s` trong `0.2s` (`12` tick), hồi chiêu `1.5s` (miễn hồi chiêu khi có **Bùa Gió**) |
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (`<= 2.0m`, chi phí `10` đom đóm/đèn) |
| `R` | **Tỏa Sáng (`Pulse`)** — tốn `3` đom đóm, bán kính 3D `5m`, hồi chiêu `3s`, làm choáng Bóng Mực `120` tick & đẩy lùi `4m`, đánh rơi lại đom đóm từ Gió Lạc |
| `Esc` hoặc `P` | **Tạm dừng (`Pause`)** — dừng toàn bộ logic, mở menu Tiếp tục / Chơi lại / Cài đặt / Về Menu |
| `Q` / `C` hoặc **Kéo chuột** | Xoay góc nhìn Camera 3D quanh Mây (`cam_yaw_deg`) |

---

## 3. Cách Tính Điểm & Số liệu Chuẩn (TICKET-02 · Contract v1.1)

- **Nạp đom đóm vào đèn (`deposit`):** `+10 điểm` / mỗi đom đóm nạp (`score.per_mote = 10`). Sức chứa tối đa `carry_capacity = 10`.
- **Thắp sáng Đèn Lồng Lớn (`lantern_lit`):** `+100 điểm` / đèn (`score.per_lantern = 100`). Mỗi đèn cần `lantern_cost = 10` đom đóm, tạo vùng an toàn `safe_radius = 6.0m`.
- **Tỏa sáng làm choáng Bóng Mực (`pulse`):** `+5 điểm` / mỗi Bóng Mực trúng Tỏa Sáng (`score.per_stun = 5`).
- **Thưởng Chiến thắng (`all_lit`):** `+ floor(time_left_s) * 2 + 50 * flames`. Tổng điểm chiến dịch là tổng điểm của các Đêm đã thắng.
- **Ba Hòn Đảo:**
  - **Đêm 1 — Đảo Bến (`300s`):** Đảo tròn `R = 40m`, 5 Đèn Lồng (`L1..L5`), tối đa 6 Bóng Mực (`4.0 m/s`).
  - **Đêm 2 — Đảo Cau (`330s`):** 2 đảo tròn `R = 28m` nối bằng cầu tre, 2 Bục nhảy phóng qua biển mây, 6 Đèn Lồng (`L1..L6`), Bùa Gió `C1` và Gió Lạc (`Drifters`).
  - **Đêm 3 — Đảo Chuông (`360s`):** Đảo tròn `R = 45m` gồm 3 tầng (`Y = 0, 3, 6`), 2 dốc đá (`30°, 150°`), Bục nhảy lên đỉnh Tháp Chuông 8m, 7 Đèn Lồng (`L1..L7`), 2 Bùa Gió, Gió Lạc và Cơn Gió Mạnh mỗi `30s`.

---

## 4. Sáng tạo của tôi (Hạng mục F — Giữ Phase 1 & Mở rộng Phase 2)

Toàn bộ phần sáng tạo nằm ở tầng hiển thị/âm thanh `web/`, **không làm thay đổi bất kỳ dòng đầu ra JSONL nào của `headless.py`**:

1. **Nhân vật Ông Đăng (Lão Giữ Đèn) & Cutscene Dẫn truyện 3 Đêm:**
   - Mô hình 3D Cel-Shaded của **Ông Đăng** cầm trượng đèn lồng đứng tại quảng trường xuất phát cùng lời dẫn truyện riêng cho từng Đêm (Đảo Bến → Đảo Cau → Đảo Chuông → Bình Minh) kèm họa tiết SVG vẽ nét bằng `Anime.js`.
2. **Sinh vật trang trí: Đàn Cá Mây (`Cloud Koi`) dưới Biển Mây:**
   - Đàn cá chép ánh sáng vàng bơi lượn dưới lớp Biển Mây (`#12384A`) quanh đảo và dưới gầm cầu tre Đảo Cau.
3. **Hiệu ứng 3D Anime cho Bùa Gió, Gió Lạc & Cơn Gió Đêm 3:**
   - Khi nhặt **Bùa Gió**, lá bùa đỏ `#C8102E` viền vàng `#F2C14E` bay xoay quanh người Mây; **Gió Lạc** uốn lượn như dải lụa bạc `#8FA3B8`; ở Đêm 3, lá phong vàng bay ngang màn hình theo đúng góc gió `dir_deg` báo trước 2 giây trước mỗi cơn gió mạnh.
4. **Bộ Tổng hợp Âm thanh Web Audio API 10 Hiệu ứng + Nhạc nền Đêm (`web/audio.js`):**
   - Nhạc nền đêm ngũ cung êm dịu cùng đầy đủ 10 hiệu ứng âm thanh chuẩn (nhặt, bùa gió, thắp đèn, tỏa sáng, bị đánh, nhảy/bục nhảy, lướt, Bóng Mực xuất hiện, đếm ngược 10 giây cuối, thắng/thua).

> **Bằng chứng phần lõi không bị ảnh hưởng:** Toàn bộ **17/17 bài test** trong `tests/test_contract_phase1.py` và `tests/test_contract_phase2.py` đều đạt 100% trong `1.36 giây` (xem [docs/proof/phase2/PROOF.md](docs/proof/phase2/PROOF.md)).

---

## 5. Hồ sơ AI SDLC, Bằng chứng & Tài liệu

- [AGENTS.md](AGENTS.md) — Hướng dẫn cố định cho AI Agent (cập nhật Contract v1.1).
- [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) — Skill tự động hóa kiểm chứng Phase.
- [.githooks/pre-commit](.githooks/pre-commit) — Git hook chặn commit khi cú pháp hoặc test lỗi.
- [docs/notes/phase1-spec-and-assumptions.md](docs/notes/phase1-spec-and-assumptions.md) & [docs/notes/phase2-spec-and-assumptions.md](docs/notes/phase2-spec-and-assumptions.md) — Đặc tả yêu cầu, tiêu chí nghiệm thu và lý do cập nhật thiết kế.
- [docs/notes/ai-log.md](docs/notes/ai-log.md) — Nhật ký dùng AI, phân tích lỗi và ước tính token qua các Phase.
- [docs/proof/phase1/PROOF.md](docs/proof/phase1/PROOF.md) & [docs/proof/phase2/PROOF.md](docs/proof/phase2/PROOF.md) — Bằng chứng thực thi, output JSONL, SHA-256 determinism và ảnh chụp 3D.
- [CREDITS.md](CREDITS.md) & [LICENSE](LICENSE) — Nguồn thư viện mã nguồn mở và giấy phép MIT.
