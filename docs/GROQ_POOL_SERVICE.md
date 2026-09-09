# 🚀 Groq Model Pool Service — Hướng Dẫn Tích Hợp

Service quản lý tập trung tài nguyên Groq API thông minh với cơ chế **chuyển đổi dự phòng theo độ ưu tiên (Priority Fallback)**, **ngắt mạch tự động (Circuit Breaker)** và **bóc tách JSON chịu lỗi cao (Fault-tolerant JSON Parser)**.

---

## 📌 1. Tính Năng Cốt Lõi

* **Tự động chuyển đổi dự phòng (O(n) Fallback)**: Khi model có độ ưu tiên cao gặp lỗi hoặc hết hạn mức, hệ thống tự động gọi model kế tiếp mà không làm gián đoạn request của người dùng.
* **Quy chế Cooldown thông minh**:
  * `429` (Chạm Rate Limit / Hết Quota): Cooldown **60s**.
  * `5xx` (Lỗi máy chủ Groq): Cooldown **15s**.
  * Timeout / Mất kết nối mạng: Cooldown **5s**.
  * Parse JSON thất bại (`requireJson: true`): Cooldown **3s**.
  * **3 lỗi liên tiếp**: Kích hoạt **Circuit Breaker** khóa model trong **120s**.
* **Bóc tách JSON chịu lỗi cao (`safeParseLlmJson`)**:
  * Tự động lọc sạch thẻ suy luận `<think>...</think>`.
  * Tự động sửa và đóng ngoặc JSON bị cắt ngang do chạm trần `max_tokens`.
  * Khắc phục lỗi dấu phẩy thừa (trailing commas), smart quotes (`“”`), và literals Python (`True/False/None`).
* **Hỗ trợ cờ `requireJson: true`**: Nếu model trả về văn bản không thể parse được thành JSON, hệ thống sẽ ghi nhận token tiêu thụ, phạt cooldown 3s cho model đó và **tự động gọi model kế tiếp để lấy JSON chuẩn xác**.

---

## 🏗️ 2. Danh Sách Model & Độ Ưu Tiên (Priority Order)

| Ưu tiên | Tên Model | RPM | TPM | RPD | TPD | Max Output | Ghi chú |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `openai/gpt-oss-120b` | 30 | 8,000 | 1,000 | 200,000 | 4,096 | Reasoning model, effort: low |
| **2** | `qwen/qwen3.6-27b` | 30 | 8,000 | 1,000 | 200,000 | 4,096 | Reasoning model, effort: none |
| **3** | `llama-3.3-70b-versatile` | 30 | 12,000 | 1,000 | 100,000 | 4,096 | Fast & versatile |
| **4** | `groq/compound` | 30 | 70,000 | 250 | Không giới hạn | 8,192 | Hạn mức token rất lớn |
| **5** | `groq/compound-mini` | 30 | 70,000 | 250 | Không giới hạn | 8,192 | Nhẹ & tốc độ cao |
| **6** | `openai/gpt-oss-20b` | 30 | 8,000 | 1,000 | 200,000 | 4,096 | Bản rút gọn gpt-oss |
| **7** | `llama-3.1-8b-instant` | 30 | 6,000 | 14,400 | 500,000 | 4,096 | RPD lớn nhất (14,400 req/ngày) |

---

## 💻 3. Hướng Dẫn Sử Dụng Trong Code (Node.js)

### Import Service
```javascript
import { GroqPoolService } from '../services/groqPool.service.js';
// Hoặc import hàm cụ thể:
// import { callChatCompletion, safeParseLlmJson, getPoolStatus } from '../services/groqPool.service.js';
```

### Case 1: Gọi Chat Trả Về Văn Bản Thường
```javascript
const res = await GroqPoolService.callChatCompletion({
  apiKey: process.env.GROQ_API_KEY, // Hoặc truyền trực tiếp chuỗi key
  messages: [
    { role: 'system', content: 'Bạn là chuyên gia thẩm định sách.' },
    { role: 'user', content: 'Tóm tắt ngắn gọn giá trị cốt lõi của cuốn sách Đắc Nhân Tâm.' }
  ],
  temperature: 0.7,
  maxTokens: 1024
});

console.log('Model đã chọn:', res.model);
console.log('Nội dung:', res.choices[0].message.content);
console.log('Token tiêu thụ:', res.usage);
```

### Case 2: Gọi Chat Bắt Buộc Trả Về JSON (`requireJson: true`)
Khi bật `requireJson: true`, kết quả đã parse sẽ nằm tại `res.parsed`. Bạn **không cần** `JSON.parse` thủ công.
```javascript
const res = await GroqPoolService.callChatCompletion({
  apiKey: process.env.GROQ_API_KEY,
  messages: [
    { 
      role: 'system', 
      content: 'Chỉ trả về JSON object duy nhất gồm các key: title, author, key_lesson' 
    },
    { role: 'user', content: 'Phân tích cuốn Hoàng Tử Bé.' }
  ],
  requireJson: true,
  maxTokens: 2048
});

// Object JavaScript đã được validate và bóc tách an toàn:
console.log(res.parsed.title);      // "Hoàng Tử Bé"
console.log(res.parsed.key_lesson); // "Thấy rõ nhất là bằng trái tim..."
```

### Case 3: Kiểm Tra Trạng Thái & Quota Hiện Tại
```javascript
const status = GroqPoolService.getPoolStatus();
console.table(status);
```

---

## 🌐 4. Tích Hợp Qua REST API & Kiểm Thử Curl

Server đã mở sẵn 2 endpoint tại cổng backend:

### 1. Xem trạng thái Pool (`GET /api/v1/groq/status`)
```bash
curl -s http://localhost:5000/api/v1/groq/status
```

### 2. Gửi request Chat thường (`POST /api/v1/groq/chat`)
```bash
curl -s -X POST http://localhost:5000/api/v1/groq/chat \
  -H "Content-Type: application/json" \
  --data-raw '{
    "apiKey": "gsk_your_groq_api_key_here",
    "messages": [
      { "role": "user", "content": "Chào bạn, hãy giới thiệu 1 câu ngắn gọn." }
    ]
  }'
```

### 3. Gửi request Structured JSON (`POST /api/v1/groq/chat`)
```bash
curl -s -X POST http://localhost:5000/api/v1/groq/chat \
  -H "Content-Type: application/json" \
  --data-raw '{
    "apiKey": "gsk_your_groq_api_key_here",
    "requireJson": true,
    "messages": [
      { "role": "system", "content": "Output JSON only with keys: quote, author" },
      { "role": "user", "content": "Give 1 wisdom quote." }
    ]
  }'
```
*Kết quả trả về sẽ có thêm trường `"parsed": { "quote": "...", "author": "..." }`.*

---

## 🧪 5. Chạy Bộ Kiểm Thử Tự Động (Automated Tests)

Tại thư mục `server/`, chạy:
```bash
npm run test:groq
```
Bộ test gồm 14 bài kiểm tra bao quát 100% logic:
- Lọc thẻ suy luận `<think>`.
- Vá JSON bị đứt đoạn giữa chừng.
- Chuẩn hóa smart quotes và sửa cú pháp Python.
- Kiểm tra tính toán token và giới hạn cửa sổ trượt.
- Thực hiện gọi trực tiếp Groq API thật và kiểm tra bóc tách `parsed`.
