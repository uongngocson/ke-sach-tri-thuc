# 🌳 Cáo Sách — The Knowledge Tree

<p align="center">
  <img src="./assets/logo.svg" alt="Cáo Sách Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Không gian 3D tương tác kết nối những tâm hồn yêu sách, gieo mầm tri thức và lan tỏa tinh hoa văn hóa đọc.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Three.js-r128-black?style=flat-square&logo=three.js" alt="Three.js" />
  <img src="https://img.shields.io/badge/WebGL-Interactive%203D-orange?style=flat-square&logo=webgl" alt="WebGL" />
  <img src="https://img.shields.io/badge/GLSL-Procedural%20Shaders-4A90E2?style=flat-square" alt="Shaders" />
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B%20Modules-yellow?style=flat-square&logo=javascript" alt="JavaScript" />
  <img src="https://img.shields.io/badge/CSS3-Dark%2FLight%20Mode-blue?style=flat-square&logo=css3" alt="CSS3" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 Giới thiệu Dự Án

**Cáo Sách** là một nền tảng trải nghiệm web 3D nghệ thuật và tương tác, lấy cảm hứng từ hình tượng cây đại thụ trăm năm – nơi mỗi nhánh cây, chiếc lá đại diện cho một cuốn sách tinh hoa, một trích dẫn đắt giá hay một bài học nhân sinh sâu sắc.

Dự án kết hợp đồ họa không gian ba chiều thời gian thực (**Three.js & WebGL**) cùng hệ thống bầu trời thiên văn mô phỏng 24 giờ (**Procedural Sky Shaders**), mang đến một không gian đọc sách tĩnh lặng, giàu cảm xúc và truyền cảm hứng.

---

## ✨ Tính năng Nổi bật

### 🌳 1. Động cơ Cây Cổ Thụ 3D (Procedural 3D Tree Engine)
- **Thuật toán sinh nhánh tự nhiên**: Tạo khung thân cây, cành lá theo cấu trúc phân nhánh fractal chân thực.
- **Vật lý gió & Tán lá sinh động**: Hỗ trợ hiệu ứng gió đung đưa (*Wind Sway Physics*), vật liệu vỏ cây chi tiết và đa dạng loại lá (*Oak, Ash, Aspen, Flowers*).
- **Tối ưu hóa tài nguyên**: Cơ chế tải ảnh vân bề mặt lười (*Lazy Texture Loading*), tăng tốc độ khởi tạo ban đầu và mượt mà trên mọi thiết bị.
- **Neo chuẩn xác theo địa hình**: Cây tự động căn chỉnh và khóa tọa độ gốc vào đường chân trời trên mọi độ phân giải màn hình.

### 🌌 2. Hệ thống Bầu Trời 24 Giờ Thực Tế (Realistic Sky Shaders)
- **Chu kỳ ngày/đêm tự nhiên**: Mô phỏng quỹ đạo Mặt Trời, Mặt Trăng, sự tán xạ khí quyển và dải ngân hà theo thời gian thực (Local Time) hoặc theo điều khiển thủ công.
- **Chuyển đổi giao diện Sáng / Tối thông minh**: Tự động hòa quyện ánh sáng bầu trời 3D mượt mà khi người dùng chuyển đổi Dark/Light mode.
- **Bảng điều khiển Dev Scrubber**: Cho phép kéo tua nhanh thời gian trong ngày để chiêm ngưỡng cảnh bình minh, hoàng hôn rực rỡ và bầu trời đêm ngàn sao.

### 📚 3. Vườn Tri Thức & Trích Dẫn Tương Tác
- **Khám phá trích dẫn**: Click trực tiếp vào từng tán lá, quả ngọt hay gốc cây để mở danh ngôn, đoạn trích sách hay và thông tin tác giả.
- **Phân loại đa dạng chủ đề**:
  - 📚 *Sách Tinh Hoa*
  - 💡 *Sách Tư Duy & Trí Tuệ*
  - 🌱 *Sách Kỹ Năng & Phát Triển Bản Thân*
  - 📜 *Sách Triết Học & Chiêm Nghiệm*
  - 🎨 *Sách Nghệ Thuật & Cảm Hứng*
- **Hiệu ứng bụi khí & Hạt ánh sáng**: Particle Canvas tạo hiệu ứng đom đóm, lá rơi nhẹ nhàng theo nhịp thở của tự nhiên.

---

## 🛠️ Công nghệ Sử dụng

| Thành phần | Công nghệ / Thư viện | Mô tả |
| :--- | :--- | :--- |
| **Core** | `HTML5`, `CSS3 (Vanilla)`, `JavaScript (ESM)` | Cấu trúc web chuẩn hiện đại, không phụ thuộc framework cồng kềnh |
| **3D Rendering** | `Three.js`, `WebGL` | Dựng hình không gian 3D, chiếu sáng và vật liệu |
| **Shaders** | `GLSL` (Custom Vertex/Fragment) | Xử lý bầu trời thiên văn, tán xạ Rayleigh/Mie, mây trời |
| **Controls & Tuning** | `lil-gui` | Bảng điều khiển tham số đồ họa thời gian thực |
| **Typography** | Google Fonts (`Quicksand`) | Kiểu chữ mềm mại, hiện đại và chuẩn tiếng Việt |
| **Deployment** | Vercel / Netlify / GitHub Pages | Hỗ trợ triển khai tĩnh tức thì |

---

## 📂 Cấu trúc Thư mục

```text
Sach-tri-thuc/
├── assets/
│   ├── ground/                 # Tài nguyên mặt đất & chân trời
│   ├── sky/                    # Hệ thống bầu trời 24h & Shaders
│   │   ├── components/         # Canvas bầu trời, DevScrubber điều khiển
│   │   ├── shaders/            # GLSL Vertex & Fragment Shaders
│   │   ├── RealisticSky.js     # Entry point điều phối hệ thống bầu trời
│   │   └── three.min.js        # Three.js runtime
│   ├── tree/                   # Động cơ Cây 3D Procedural
│   │   ├── textures/           # Texture vỏ cây & các loại lá
│   │   ├── tree.js             # Thuật toán sinh cây và mesh lá
│   │   ├── TreeManager.js      # Bộ điều phối vị trí, ánh sáng và tham số cây
│   │   └── lil-gui.module.min.js
│   ├── logo.svg                # Logo biểu trưng Cây Sách
│   └── styles-7DMGWVIM.css     # Hệ thống stylesheet & dark mode
├── index.html                  # Giao diện chính của ứng dụng
├── README.md                   # Tài liệu hướng dẫn dự án
└── .gitignore
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy Cục bộ

Dự án là một ứng dụng Web tĩnh (Zero-build Static App), bạn có thể chạy ngay với bất kỳ web server đơn giản nào:

### Cách 1: Sử dụng VS Code Live Server (Khuyến nghị)
1. Mở thư mục `Sach-tri-thuc` bằng **Visual Studio Code**.
2. Cài đặt tiện ích mở rộng **Live Server**.
3. Nhấp chuột phải vào file `index.html` và chọn **Open with Live Server**.

### Cách 2: Sử dụng Node.js `serve` / `http-server`
```bash
# Cài đặt và chạy với npx
npx serve .

# Hoặc dùng http-server
npx http-server -p 3000
```
Truy cập trình duyệt tại: `http://localhost:3000` hoặc `http://localhost:5000`

### Cách 3: Sử dụng Python
```bash
# Python 3
python -m http.server 8080
```
Mở trình duyệt: `http://localhost:8080`

---

## 🌐 Triển khai (Deployment)

Dự án sẵn sàng triển khai trên mọi dịch vụ lưu trữ web tĩnh:

- **Vercel**: Liên kết repository GitHub hoặc chạy `vercel --prod`.
- **GitHub Pages**: Đẩy code lên nhánh `main`, vào Settings > Pages > Source chọn root `/`.
- **Netlify**: Kéo thả thư mục dự án hoặc kết nối repo Git để deploy tự động.

---

## 💡 Đóng góp & Phát triển

Mọi ý kiến đóng góp, bổ sung trích dẫn sách hoặc tối ưu mã nguồn đều được hoan nghênh:

1. **Fork** dự án.
2. Tạo nhánh tính năng mới (`git checkout -b feature/AmazingQuote`).
3. Commit các thay đổi (`git commit -m 'Add some inspiring quotes'`).
4. Push nhánh lên GitHub (`git push origin feature/AmazingQuote`).
5. Mở một **Pull Request**.

---

## 📜 Giấy phép

Dự án được phân phối dưới giấy phép **MIT License**. Bạn hoàn toàn có thể tự do học tập, sử dụng và phát triển phi thương mại hoặc thương mại.

---

<p align="center">
  Được xây dựng với 💚 bởi <strong>Độc giả Yêu Sách</strong> • Lan tỏa vẻ đẹp của tri thức
</p>
