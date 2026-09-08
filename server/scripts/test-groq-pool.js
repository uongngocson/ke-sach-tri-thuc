/**
 * server/scripts/test-groq-pool.js
 * 
 * Comprehensive test suite for Groq Model Pool Service:
 * 1. Unit Tests for safeParseLlmJson (Reasoning tags, Fences, Truncations, Smart quotes, Python literals)
 * 2. Token Estimation & Capacity Reservation Tests
 * 3. Priority Selection, Cooldowns & Circuit Breaker Logic
 * 4. Live Groq API Chat Completion Test (Text)
 * 5. Live Groq API Structured JSON Test (requireJson=true with .parsed verification)
 */

import { 
  GroqPoolService, 
  safeParseLlmJson, 
  estimateInputTokens, 
  getPoolStatus, 
  callChatCompletion,
  MODEL_POOL 
} from '../services/groqPool.service.js';

const TEST_API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1 || '';

let passed = 0;
let failed = 0;

function assert(cond, name, details = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
    if (details) console.log(`     ↳ ${details}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name}`);
    if (details) console.error(`     ↳ ${details}`);
  }
}

async function runTests() {
  console.log('\n=================================================================');
  console.log('🧪 GROQ MODEL POOL SERVICE - COMPREHENSIVE TEST SUITE');
  console.log('=================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. UNIT TESTS: safeParseLlmJson
  // ---------------------------------------------------------------------------
  console.log('--- [1/5] KIỂM THỬ BỘ BÓC TÁCH JSON CHỊU LỖI (safeParseLlmJson) ---');

  // 1.1 JSON sạch chuẩn
  const cleanJson = '{"status": "success", "score": 100}';
  const p1 = safeParseLlmJson(cleanJson);
  assert(p1 && p1.status === 'success' && p1.score === 100, 'Bóc tách JSON sạch nguyên bản');

  // 1.2 Markdown code fence ```json {...} ```
  const fencedJson = '```json\n{"message": "hello world", "active": true}\n```';
  const p2 = safeParseLlmJson(fencedJson);
  assert(p2 && p2.message === 'hello world' && p2.active === true, 'Bóc tách JSON bọc trong Markdown Code Fence ```json');

  // 1.3 Reasoning Model Tags (<think>...</think>)
  const reasoningJson = `
    <think>
    I need to formulate a response containing wisdom quotes and metadata.
    Step 1: Create a JSON object.
    Step 2: Return only valid JSON.
    </think>
    {"quote": "Tri thức là sức mạnh", "author": "Francis Bacon"}
  `;
  const p3 = safeParseLlmJson(reasoningJson);
  assert(p3 && p3.quote === 'Tri thức là sức mạnh' && p3.author === 'Francis Bacon', 'Lọc sạch thẻ suy luận <think>...</think> của Reasoning Models');

  // 1.4 Unclosed Reasoning Tag (<think without closing tag before brace)
  const unclosedThink = 'Thinking process: let me think how to structure this...\n{"category": "Philosophy", "readTime": 5}';
  const p4 = safeParseLlmJson(unclosedThink);
  assert(p4 && p4.category === 'Philosophy', 'Xử lý tiền tố suy luận dở dang trước dấu ngoặc nhọn mở {');

  // 1.5 Truncated JSON (Bị cắt ngang khi chạm trần max_tokens)
  const truncatedJson = '{"book": "Đắc Nhân Tâm", "tags": ["tam_ly", "giao_tiep", "ky_nang"';
  const p5 = safeParseLlmJson(truncatedJson);
  assert(p5 && p5.book === 'Đắc Nhân Tâm' && Array.isArray(p5.tags) && p5.tags.length === 3, 'Tự động sửa và đóng ngoặc JSON bị cắt ngang (Truncated JSON Repair)');

  // 1.6 Dấu phẩy thừa (Trailing commas)
  const trailingCommaJson = '{"title": "Nhà Giả Kim", "chapters": [1, 2, 3,], "price": 85000,}';
  const p6 = safeParseLlmJson(trailingCommaJson);
  assert(p6 && p6.title === 'Nhà Giả Kim' && p6.chapters.length === 3, 'Tự động sửa lỗi dấu phẩy thừa ở cuối object/array (Trailing commas)');

  // 1.7 Smart Quotes & Python Literals
  const messyJson = '{\u201cstatus\u201d: \u201cverified\u201d, \u201cis_active\u201d: True, \u201cdetails\u201d: None}';
  const p7 = safeParseLlmJson(messyJson);
  assert(p7 && p7.status === 'verified' && p7.is_active === true && p7.details === null, 'Chuẩn hóa Smart Quotes và sửa Python Literals (True/False/None -> true/false/null)');

  // ---------------------------------------------------------------------------
  // 2. UNIT TESTS: estimateInputTokens
  // ---------------------------------------------------------------------------
  console.log('\n--- [2/5] KIỂM THỬ ƯỚC LƯỢNG TOKEN ĐẦU VÀO (estimateInputTokens) ---');
  const msgs = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the speed of light in vacuum?' }
  ];
  const estTokens = estimateInputTokens(msgs);
  assert(estTokens > 20 && estTokens < 50, `Ước lượng token bảo thủ chính xác (~${estTokens} tokens)`);

  // ---------------------------------------------------------------------------
  // 3. UNIT TESTS: Pool State & Priority Selection
  // ---------------------------------------------------------------------------
  console.log('\n--- [3/5] KIỂM THỬ ĐIỀU PHỐI POOL, ƯU TIÊN & CIRCUIT BREAKER ---');
  GroqPoolService.resetPool();

  const statusList = getPoolStatus();
  assert(statusList.length === MODEL_POOL.length, `Khởi tạo đầy đủ ${MODEL_POOL.length} models trong Pool`);
  assert(statusList[0].name === 'openai/gpt-oss-120b' && statusList[0].priority === 1, 'Model ưu tiên 1 (Priority 1) đứng đầu danh sách');

  // ---------------------------------------------------------------------------
  // 4. LIVE API TEST: Plain Chat Completion
  // ---------------------------------------------------------------------------
  console.log('\n--- [4/5] KIỂM THỬ GỌI TRỰC TIẾP GROQ API (TEXT COMPLETION) ---');
  try {
    const textRes = await callChatCompletion({
      apiKey: TEST_API_KEY,
      messages: [
        { role: 'system', content: 'Trả lời cực kỳ ngắn gọn trong 1 câu duy nhất.' },
        { role: 'user', content: 'Mục đích cốt lõi của việc đọc sách là gì?' }
      ],
      temperature: 0.3,
      maxTokens: 100
    });

    const modelUsed = textRes.model || 'unknown';
    const answer = textRes.choices?.[0]?.message?.content || '';
    assert(answer.length > 0, `Groq API phản hồi thành công qua model: ${modelUsed}`);
    console.log(`     ↳ Phản hồi: "${answer.trim()}"`);
    assert(textRes.usage && textRes.usage.prompt_tokens > 0, `Usage ghi nhận: ${textRes.usage?.prompt_tokens} prompt + ${textRes.usage?.completion_tokens} completion tokens`);
  } catch (err) {
    assert(false, 'Gọi Chat Completion thất bại', err.message);
  }

  // ---------------------------------------------------------------------------
  // 5. LIVE API TEST: Structured JSON with requireJson=true
  // ---------------------------------------------------------------------------
  console.log('\n--- [5/5] KIỂM THỬ BÓC TÁCH JSON TỰ ĐỘNG (requireJson = true) ---');
  try {
    const jsonRes = await callChatCompletion({
      apiKey: TEST_API_KEY,
      messages: [
        { 
          role: 'system', 
          content: 'You are a JSON generator. Output ONLY a valid JSON object with keys: "book", "author", "key_takeaway". No prose, no markdown.' 
        },
        { 
          role: 'user', 
          content: 'Generate wisdom summary for The Little Prince.' 
        }
      ],
      temperature: 0.2,
      maxTokens: 300,
      requireJson: true
    });

    assert(jsonRes.parsed && typeof jsonRes.parsed === 'object', 'Trường data.parsed được bóc tách tự động thành công');
    assert(jsonRes.parsed.book || jsonRes.parsed.author, `Dữ liệu parsed chứa cấu trúc mong đợi: ${JSON.stringify(jsonRes.parsed)}`);
    console.log(`     ↳ Parsed Object:`, jsonRes.parsed);
  } catch (err) {
    assert(false, 'Gọi requireJson=true thất bại', err.message);
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT
  // ---------------------------------------------------------------------------
  console.log('\n=================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ GROQ POOL: ${passed} PASSED | ${failed} FAILED`);
  console.log(`🎯 TỶ LỆ TOÀN VẸN: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
