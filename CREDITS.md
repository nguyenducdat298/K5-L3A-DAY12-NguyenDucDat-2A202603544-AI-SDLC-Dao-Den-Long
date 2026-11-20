# CREDITS — Đảo Đèn Lồng

## 1. Bản gốc & Nội dung trò chơi
- **Bối cảnh, bản đồ 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông) & Thiết kế lõi:** Bản gốc theo đề bài Lab Day 12 AI SDLC (VinUni-AI20k Khóa 5).
- **Mô hình 3D & Hiệu ứng đồ họa Anime Cel-Shading (Procedural Fan-Creation Tribute):**
  - Toàn bộ mô hình 3D trong repo (nhân vật khớp xương phong cách **Evernight HSR**, tinh thể **Memoria**, súng **Vandal** góc nhìn thứ nhất/thứ ba, băng đạn trên sàn đấu và hiệu ứng **Lướt Genshin Elemental Dash**) được **tự dựng 100% bằng mã nguồn hình học thủ tục (Procedural Three.js Geometries + Anime.js Keyframes)** theo tinh thần fan-creation phi thương mại, không sao chép hay nhúng bất kỳ tệp tài nguyên trích xuất có bản quyền nào.
- **Âm thanh (SFX & BGM):** Tổng hợp thời gian thực bằng **Web Audio API** (`web/audio.js`) — 0KB tệp âm thanh bên ngoài.

## 2. Thư viện Mã nguồn mở (Open-Source Libraries)
- **Three.js (`v0.160.0`)** — Giấy phép **MIT** (`https://github.com/mrdoob/three.js`), lưu cục bộ tại `web/vendor/three.module.min.js`.
- **Anime.js (`v3.2.2`)** — Giấy phép **MIT** (`https://github.com/juliangarnier/anime`), lưu cục bộ tại `web/vendor/anime.es.js`.
- **Python 3 Standard Library** — Giấy phép **PSF License**.

## 3. Công cụ AI hỗ trợ
- **Antigravity AI Agent & Subagent (`prd-analyst`):** Hỗ trợ phân tích PRD-0, thiết kế kiến trúc tách biệt Core/View, sinh bộ kiểm thử tự động theo Test Contract v1.0 và hiệu ứng 3D Anime.
