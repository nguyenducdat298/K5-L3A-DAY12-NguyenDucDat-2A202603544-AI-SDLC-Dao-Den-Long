# Báo Cáo Retrospective (Retro) — Đảo Đèn Lồng (4 Phases · AI SDLC Lab)

> **Học viên:** Nguyễn Đức Đạt · **MSSV:** `2A202603544` · **Lớp:** `L3A`
> **Phiên bản phát hành:** `v1.0.0` (`tag: phase-4` · **Test Contract v1.3**)

---

## 1. Tổng Hợp Đánh Giá (Evaluation) Qua 4 Phase

| Phase | Tag & Contract | Mục tiêu cốt lõi | Bộ Test Tự Động | Thời gian chạy Test | Kết quả |
|---|---|---|---|---|---|
| **Phase 1** | `phase-1` (`v1.0`) | Đêm 1 (Đảo Bến), 5 Đèn Lồng, Đom Đóm, Bóng Mực, Tỏa Sáng, Headless JSONL | 8 tests (`test_contract_phase1.py`) | `0.21s` | **8/8 PASS (100%)** |
| **Phase 2** | `phase-2` (`v1.1`) | Chuẩn hóa số liệu 60Hz, Lướt (`Dash`), 3 Đêm (Đảo Bến / Đảo Cau / Đảo Chuông), Bùa Gió, Gió Lạc, Cơn Gió Mạnh, Tạm dừng | 17 tests (`phase1` + `phase2`) | `0.58s` | **17/17 PASS (100%)** |
| **Phase 3** | `phase-3` (`v1.2`) | Change Request "Đèn cạn dầu": Nhiên liệu đèn (`1/60` tick), Châm dầu (`refuel`), Thắp lại (`relight`), Bóng Mực hút dầu (`drain`), Sức chứa động, `dawn_survived`, Chế độ mù màu | 22 tests (`phase1` + `phase2` + `phase3`) | `0.67s` | **22/22 PASS (100%)** |
| **Phase 4** | `phase-4` / `v1.0.0` (`v1.3`) | Benchmark 200 Bóng Mực (`bench.py`), Soak Test 10 Đêm (`soak.py`), Bảng xếp hạng cục bộ (`--export-leaderboard`), Accessibility (Đổi phím, Phụ đề, Giảm chuyển động, Cỡ chữ ×1.25), Đóng gói & Triển khai HTTPS cổng 443 | 26 tests (`phase1..4`) | `1.56s` | **26/26 PASS (100%)** |

---

## 2. Điều Gì Hiệu Quả & Không Hiệu Quả Khi Làm Việc Với AI

### Điều hiệu quả:
1. **Kiến trúc tách biệt tuyệt đối giữa Lõi Mô Phỏng Tất Định (`src/sim.py` / `web/sim.js`) và Tầng Hiển Thị 3D (`web/main.js`):**
   - Mọi sáng tạo đồ họa 3D (góc nhìn FPS/TPS, súng Quang Tiễn, hoạt ảnh nạp đạn, hiệu ứng vỡ tan và biến mất 10 giây khi quái/Gió Lạc hết máu, Ông Đăng, Cá Mây) được giữ hoàn toàn ở tầng View (`web/`). Nhờ vậy, đầu ra `headless.py` luôn tuân thủ 100% Test Contract từ `v1.0` đến `v1.3` mà không bao giờ bị nhiễu bởi hiệu ứng hình ảnh.
2. **Quy trình Spec-First & ADR trước khi viết mã (Đặc biệt ở Phase 3 Change Request):**
   - Việc lập bảng đối chiếu các luật bị `[THAY THẾ]` trong `docs/notes/phase3-adr-and-spec.md` (ADR-03) và quyết định biểu diễn dầu bằng số nguyên `fuel_ticks` (`6000` ticks = `100.0` fuel) trước khi sửa code đã loại bỏ hoàn toàn lỗi sai số dấu phẩy động (`IEEE-754 drift`).

### Điều chưa hiệu quả nếu không kiểm soát:
- Khi yêu cầu AI sửa giao diện 3D lớn (`web/main.js` > 2.500 dòng), nếu không tách rõ tên thuộc tính giữa các đối tượng 3D (ví dụ `this.fpsRifle.gun` so với `this.fpsRifle.group`), AI dễ tạo lỗi `TypeError` ở runtime trình duyệt mà kiểm tra cú pháp tĩnh không bắt được nếu không chạy trình duyệt tự động (Playwright).

---

## 3. Những Lần AI Sai & Cách Phát Hiện / Khắc Phục

1. **Lỗi 1 (Phase 1 — Hiệu năng WebGL phần mềm trong Headless Browser):**
   - *Hiện tượng:* Khi bật 5 `PointLight` có `castShadow = true` cùng 55 hạt sương mù, tốc độ khung hình trên trình duyệt headless chỉ đạt ~18 FPS.
   - *Cách phát hiện:* Đo FPS thực tế bằng Playwright Firefox.
   - *Cách sửa:* Chỉ bật `PointLight.visible = true` cho các đèn đã thắp sáng, tắt shadow map nặng và dùng vòng tròn phát sáng (`RingGeometry`), đưa tốc độ lên 60+ FPS ổn định.
2. **Lỗi 2 (Phase 3 — Thứ tự chuyển trạng thái Bóng Mực trong cùng 1 tick sau khi hết choáng):**
   - *Hiện tượng:* Ở Bước 2 của tick, Bóng Mực giảm `state_ticks_left` về `0` và chuyển từ `stunned` về `wander`. Tuy nhiên đến Bước 8 của chính tick đó, logic lại xét khoảng cách và chuyển ngay Bóng Mực sang `chase` hoặc `drain`.
   - *Cách phát hiện:* Bài test tự động `test_shade_drain_and_pulse_bonus_15` trong `tests/test_contract_phase3.py` phát hiện ngay lập tức.
   - *Cách sửa:* Lưu tập `just_unstunned_ids` ở Bước 2 để bỏ qua xét chuyển trạng thái tại Bước 8 trong đúng tick vừa tỉnh lại.
3. **Lỗi 3 (Phase 4 — Gọi nhầm `self.rng.random()` thay vì `self.rng.next_float()` trên bộ sinh số ngẫu nhiên `Mulberry32`):**
   - *Cách phát hiện:* Chạy trực tiếp `python3 bench.py --seed 42 --duration 30 --out bench.json` và bài test `test_benchmark_scene_and_runner`.
   - *Cách sửa:* Chuẩn hóa lời gọi `self.rng.next_float()` đồng nhất giữa `src/sim.py` và `web/sim.js`.

---

## 4. Harness AI Nào Giúp Nhiều Nhất?

1. **Git Pre-commit Hook (`.githooks/pre-commit`)**:
   - Tự động chạy `python3 -m py_compile` và toàn bộ `python3 -m unittest discover -s tests` trước mỗi lần `git commit`. Đây là "chốt chặn" quan trọng nhất đảm bảo không có bất kỳ commit hay git tag (`phase-1..4`) nào bị gãy regression.
2. **`AGENTS.md` + Skill `.agents/skills/verify-phase/SKILL.md`**:
   - Giữ cố định bảng thứ tự 12 bước mỗi tick và danh sách kiểm tra Determinism (`SHA-256`), giúp AI không bị "quên luật cũ" khi ngữ cảnh hội thoại dài qua 4 phase.

---

## 5. Tổng Token / Chi Phí AI Ước Tính & Chiến Lược Tiết Kiệm Token

| Hạng mục | Input / Output Tokens (Ước tính) | Chiến lược tiết kiệm Token đã áp dụng |
|---|---|---|
| **Phase 1 (`v1.0`)** | ~42,000 tokens | Dùng Subagent `prd-analyst` tóm tắt PRD-0 thành checklist ngắn gọn trước khi code. |
| **Phase 2 (`v1.1`)** | ~38,000 tokens | Tái sử dụng cấu trúc `GameSimulation`, chỉ mở rộng `build_night_map_config(night)`. |
| **Phase 3 (`v1.2`)** | ~28,000 tokens | Viết ADR-03 ngắn gọn, sửa trực tiếp theo dòng (`edit_file`) thay vì viết lại cả file. |
| **Phase 4 (`v1.3`)** | ~34,000 tokens | Tách `bench.py` và `soak.py` thành module độc lập; dùng script kiểm thử tự động gom nhiều bước. |
| **Tổng cộng 4 Phase** | **~142,000 tokens** (~$0.65–$1.20 tương đương API thương mại) | Đọc file theo khoảng dòng (`StartLine`/`EndLine`), tự động hóa test bằng hook thay vì debug thủ công nhiều vòng. |

---

## 6. Nếu Làm Lại Từ Đầu Thì Sẽ Đổi Gì?

1. **Dùng chung một mã nguồn mô phỏng duy nhất hoặc sinh tự động `web/sim.js` từ `src/sim.py`:** Hiện tại dự án duy trì song song `src/sim.py` (cho CLI/Headless/Bench/Soak) và `web/sim.js` (cho trình duyệt 3D). Nếu làm lại, việc viết một trình biên dịch nhỏ hoặc chạy WebAssembly/Pyodide sẽ giúp chỉ cần sửa 1 file duy nhất khi có Change Request như Phase 3.
2. **Thiết kế HUD Responsive Flexbox từ Phase 1:** Đặt 3 bảng HUD trên cùng vào một hàng Flexbox có `gap` cố định ngay từ đầu để không bao giờ xảy ra hiện tượng đè panel khi thêm nhiều nút điều khiển ở các phase sau.
