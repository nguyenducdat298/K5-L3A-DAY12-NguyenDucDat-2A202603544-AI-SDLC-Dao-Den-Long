# CREDITS — Đảo Đèn Lồng

## 1. Bản gốc & Nội dung trò chơi
- **Bối cảnh, nhân vật (Mây, Bóng Mực, Đảo Bến) & Thiết kế:** Bản gốc theo đề bài Lab Day 12 AI SDLC (VinUni-AI20k Khóa 5).
- **Mô hình 3D & Hiệu ứng đồ họa Anime Cel-Shading:** Tạo hoàn toàn bằng mã nguồn thủ tục (Procedural Three.js Geometries + Custom 4-band Anime Toon Gradient Map + Inverted-Hull Outlines) — không sử dụng model bản quyền bên ngoài.
- **Âm thanh (SFX):** Tổng hợp thời gian thực bằng **Web Audio API** (`web/audio.js` — sóng âm pentatonic chuông gió, tiếng ngân đèn lồng, sóng ánh sáng) — không sử dụng tệp âm thanh bên ngoài.

## 2. Thư viện Mã nguồn mở (Open-Source Libraries)
- **Three.js (`v0.160.0`)** — Giấy phép **MIT** (`https://github.com/mrdoob/three.js`), lưu cục bộ tại `web/vendor/three.module.min.js`.
- **Anime.js (`v3.2.2`)** — Giấy phép **MIT** (`https://github.com/juliangarnier/anime`), lưu cục bộ tại `web/vendor/anime.es.js`.
- **Python 3 Standard Library** — Giấy phép **PSF License**.

## 3. Công cụ AI hỗ trợ
- **Antigravity AI Agent & Subagent (`prd-analyst`):** Hỗ trợ phân tích PRD-0, thiết kế kiến trúc tách biệt Core/View, sinh bộ kiểm thử tự động theo Test Contract v1.0 và hiệu ứng 3D Anime.
