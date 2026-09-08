/**
 * server/services/groqPool.service.js
 * 
 * Production-grade Groq Model Pool with:
 * - O(n) Priority-based fallback (n ~= 7)
 * - Intelligent Circuit Breaker & HTTP Status-derived Cooldowns:
 *     * 429 (Rate Limit / Quota)  -> 60s cooldown
 *     * 5xx (Server Error)        -> 15s cooldown
 *     * Timeout / Network error   ->  5s cooldown
 *     * Unparsable JSON content   ->  3s cooldown
 *     * 3 Consecutive Failures    -> 120s Circuit Breaker Open
 * - Rolling-window RPM, TPM, RPD, TPD Token & Request Reservation
 * - Conservative Token Estimation
 * - Fault-tolerant LLM JSON Extractor (safeParseLlmJson):
 *     * Strips reasoning tags (<think>, <reasoning>, <reflection>)
 *     * Code fence extraction
 *     * Balanced-brace scanning
 *     * Stream truncation auto-repair (missing quotes, brackets, braces)
 *     * Smart quotes normalization & Python literals conversion
 * - requireJson=true model fallback: if model outputs malformed JSON, quota is recorded,
 *   a brief 3s cooldown is applied, and the next model is immediately tried.
 */

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

// ---------------------------------------------------------------------------
// Model Specifications & Static Pool
// ---------------------------------------------------------------------------

export class ModelSpec {
  constructor({
    name,
    priority,
    rpm_limit,
    tpm_limit,
    rpd_limit,
    tpd_limit,
    max_output_tokens,
    reasoning_effort = null,
    is_reasoning_model = false
  }) {
    this.name = name;
    this.priority = priority;
    this.rpm_limit = rpm_limit;
    this.tpm_limit = tpm_limit;
    this.rpd_limit = rpd_limit;
    this.tpd_limit = tpd_limit;
    this.max_output_tokens = max_output_tokens;
    this.reasoning_effort = reasoning_effort;
    this.is_reasoning_model = is_reasoning_model;
    Object.freeze(this);
  }
}

export const MODEL_POOL = [
  new ModelSpec({
    name: 'openai/gpt-oss-120b',
    priority: 1,
    rpm_limit: 30,
    tpm_limit: 8_000,
    rpd_limit: 1_000,
    tpd_limit: 200_000,
    max_output_tokens: 4_096,
    reasoning_effort: 'low',
    is_reasoning_model: true
  }),
  new ModelSpec({
    name: 'qwen/qwen3.6-27b',
    priority: 2,
    rpm_limit: 30,
    tpm_limit: 8_000,
    rpd_limit: 1_000,
    tpd_limit: 200_000,
    max_output_tokens: 4_096,
    reasoning_effort: 'none',
    is_reasoning_model: true
  }),
  new ModelSpec({
    name: 'llama-3.3-70b-versatile',
    priority: 3,
    rpm_limit: 30,
    tpm_limit: 12_000,
    rpd_limit: 1_000,
    tpd_limit: 100_000,
    max_output_tokens: 4_096
  }),
  new ModelSpec({
    name: 'groq/compound',
    priority: 4,
    rpm_limit: 30,
    tpm_limit: 70_000,
    rpd_limit: 250,
    tpd_limit: 10 ** 12, // Effectively unlimited
    max_output_tokens: 8_192
  }),
  new ModelSpec({
    name: 'groq/compound-mini',
    priority: 5,
    rpm_limit: 30,
    tpm_limit: 70_000,
    rpd_limit: 250,
    tpd_limit: 10 ** 12,
    max_output_tokens: 8_192
  }),
  new ModelSpec({
    name: 'openai/gpt-oss-20b',
    priority: 6,
    rpm_limit: 30,
    tpm_limit: 8_000,
    rpd_limit: 1_000,
    tpd_limit: 200_000,
    max_output_tokens: 4_096,
    reasoning_effort: 'low',
    is_reasoning_model: true
  }),
  new ModelSpec({
    name: 'llama-3.1-8b-instant',
    priority: 7,
    rpm_limit: 30,
    tpm_limit: 6_000,
    rpd_limit: 14_400,
    tpd_limit: 500_000,
    max_output_tokens: 4_096
  })
];

// ---------------------------------------------------------------------------
// Per-model Runtime Bucket
// ---------------------------------------------------------------------------

class Bucket {
  constructor(spec) {
    this.spec = spec;

    const now = Date.now();
    this.rpm_window_start = now;
    this.tpm_window_start = now;
    this.rpd_window_start = now;
    this.tpd_window_start = now;

    this.rpm_used = 0;
    this.tpm_used = 0;
    this.rpd_used = 0;
    this.tpd_used = 0;

    this.disabled_until = 0;
    this.consecutive_failures = 0;
  }
}

// ---------------------------------------------------------------------------
// Pool State & Rolling Window Logic
// ---------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const DAY_MS = 86_400 * 1000;
const PARSE_FAILURE_COOLDOWN_MS = 3 * 1000;

class PoolState {
  constructor(pool = MODEL_POOL) {
    this.modelPool = pool;
    this.buckets = new Map();
    for (const spec of this.modelPool) {
      this.buckets.set(spec.name, new Bucket(spec));
    }
  }

  _maybeReset(bucket, now) {
    if (now - bucket.tpm_window_start >= MINUTE_MS) {
      bucket.tpm_window_start = now;
      bucket.tpm_used = 0;
    }
    if (now - bucket.rpm_window_start >= MINUTE_MS) {
      bucket.rpm_window_start = now;
      bucket.rpm_used = 0;
    }
    if (now - bucket.tpd_window_start >= DAY_MS) {
      bucket.tpd_window_start = now;
      bucket.tpd_used = 0;
    }
    if (now - bucket.rpd_window_start >= DAY_MS) {
      bucket.rpd_window_start = now;
      bucket.rpd_used = 0;
    }
  }

  _hasCapacity(bucket, now, estimatedInput, maxOutput) {
    if (now < bucket.disabled_until) {
      return false;
    }
    if (bucket.rpm_used >= bucket.spec.rpm_limit) {
      return false;
    }
    if (bucket.rpd_used >= bucket.spec.rpd_limit) {
      return false;
    }
    if (bucket.tpm_used + estimatedInput + maxOutput > bucket.spec.tpm_limit) {
      return false;
    }
    if (bucket.tpd_used + estimatedInput + maxOutput > bucket.spec.tpd_limit) {
      return false;
    }
    return true;
  }

  selectModel(estimatedInputTokens, maxOutputTokens) {
    const now = Date.now();
    for (const spec of this.modelPool) {
      const bucket = this.buckets.get(spec.name);
      if (!bucket) continue;
      this._maybeReset(bucket, now);
      if (this._hasCapacity(bucket, now, estimatedInputTokens, maxOutputTokens)) {
        return bucket;
      }
    }
    return null;
  }

  commitSuccess(name, promptTokens = 0, completionTokens = 0) {
    const bucket = this.buckets.get(name);
    if (!bucket) return;
    const tokens = promptTokens + completionTokens;
    bucket.rpm_used += 1;
    bucket.rpd_used += 1;
    bucket.tpm_used += tokens;
    bucket.tpd_used += tokens;
    bucket.consecutive_failures = 0;
  }

  commitFailure(name, statusCode = null, err = null) {
    const bucket = this.buckets.get(name);
    if (!bucket) return;
    const cooldownMs = cooldownFor(statusCode, err);
    const now = Date.now();
    bucket.disabled_until = Math.max(bucket.disabled_until, now + cooldownMs);
    bucket.consecutive_failures += 1;

    // Circuit breaker: 3 consecutive strikes -> 120s cooldown
    if (bucket.consecutive_failures >= 3) {
      bucket.disabled_until = now + 120 * 1000;
      console.warn(`[GroqPool] Circuit breaker OPEN for ${name} (cooldown 120s, failures=${bucket.consecutive_failures})`);
    }
  }

  commitParseFailure(name) {
    const bucket = this.buckets.get(name);
    if (!bucket) return;
    const now = Date.now();
    bucket.disabled_until = Math.max(bucket.disabled_until, now + PARSE_FAILURE_COOLDOWN_MS);
    bucket.consecutive_failures += 1;

    if (bucket.consecutive_failures >= 3) {
      bucket.disabled_until = now + 120 * 1000;
      console.warn(`[GroqPool] Circuit breaker OPEN for ${name} due to repeated JSON parse failures (cooldown 120s)`);
    }
  }

  getStatus() {
    const now = Date.now();
    const snapshot = [];
    for (const spec of this.modelPool) {
      const bucket = this.buckets.get(spec.name);
      if (!bucket) continue;
      this._maybeReset(bucket, now);
      snapshot.push({
        name: spec.name,
        priority: spec.priority,
        disabled_for_s: Math.max(0, parseFloat(((bucket.disabled_until - now) / 1000).toFixed(1))),
        consecutive_failures: bucket.consecutive_failures,
        rpm_used: bucket.rpm_used,
        rpm_limit: spec.rpm_limit,
        tpm_used: bucket.tpm_used,
        tpm_limit: spec.tpm_limit,
        rpd_used: bucket.rpd_used,
        rpd_limit: spec.rpd_limit,
        tpd_used: bucket.tpd_used,
        tpd_limit: spec.tpd_limit
      });
    }
    return snapshot;
  }

  reset() {
    for (const bucket of this.buckets.values()) {
      const now = Date.now();
      bucket.rpm_window_start = now;
      bucket.tpm_window_start = now;
      bucket.rpd_window_start = now;
      bucket.tpd_window_start = now;
      bucket.rpm_used = 0;
      bucket.tpm_used = 0;
      bucket.rpd_used = 0;
      bucket.tpd_used = 0;
      bucket.disabled_until = 0;
      bucket.consecutive_failures = 0;
    }
  }
}

const _state = new PoolState();

// ---------------------------------------------------------------------------
// Cooldown Policy
// ---------------------------------------------------------------------------

function cooldownFor(statusCode, err) {
  if (statusCode === 429) {
    return 60 * 1000; // 60s
  }
  if (statusCode !== null && statusCode >= 500 && statusCode < 600) {
    return 15 * 1000; // 15s
  }
  if (err && (
    err.name === 'AbortError' ||
    err.name === 'TimeoutError' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED' ||
    /timeout|network|connect/i.test(err.message || '')
  )) {
    return 5 * 1000; // 5s
  }
  // Bad request (400), Auth error (401/403), or unknown: 30s cooldown
  return 30 * 1000;
}

// ---------------------------------------------------------------------------
// Conservative Input Token Estimator
// ---------------------------------------------------------------------------

export function estimateInputTokens(messages = []) {
  let totalChars = 0;
  for (const m of messages) {
    const content = m.content || '';
    if (typeof content === 'string') {
      totalChars += content.length;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === 'object' && part.text) {
          totalChars += String(part.text).length;
        }
      }
    }
  }
  return Math.max(1, Math.floor(totalChars / 4) + 16);
}

// ---------------------------------------------------------------------------
// Robust Fault-Tolerant JSON Parser (safeParseLlmJson)
// ---------------------------------------------------------------------------

const REASONING_BLOCK_PATTERNS = [
  /<think>[\s\S]*?<\/think>/gi,
  /<reasoning>[\s\S]*?<\/reasoning>/gi,
  /<reflection>[\s\S]*?<\/reflection>/gi
];

const REASONING_PREFIX_HINTS = [
  '<think',
  '<reasoning',
  '<reflection',
  'thinking process',
  'let me think',
  'step-by-step'
];

const CODE_FENCE_RE = /```(?:json|javascript|js)?\s*([\s\S]*?)\s*```/gi;
const TRAILING_COMMA_RE = /,(\s*[}\]])/g;
const ZERO_WIDTH_RE = /[\u200b\u200c\u200d\ufeff]/g;

const SMART_QUOTE_MAP = {
  '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u201f': '"',
  '\u2018': "'", '\u2019': "'"
};

const PY_LITERAL_RE = /\b(True|False|None)\b/g;
const PY_LITERAL_MAP = { True: 'true', False: 'false', None: 'null' };

function _stripReasoningAndNoise(text) {
  let cleaned = text;
  for (const pat of REASONING_BLOCK_PATTERNS) {
    cleaned = cleaned.replace(pat, '');
  }

  const firstBraceIdx = cleaned.indexOf('{');
  if (firstBraceIdx > 0) {
    const prefix = cleaned.substring(0, firstBraceIdx).toLowerCase();
    if (REASONING_PREFIX_HINTS.some(hint => prefix.includes(hint))) {
      cleaned = cleaned.substring(firstBraceIdx);
    }
  }

  cleaned = cleaned.replace(ZERO_WIDTH_RE, '');
  return cleaned.trim();
}

function _stripFence(text) {
  return text
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function _fixTrailingCommas(text) {
  return text.replace(TRAILING_COMMA_RE, '$1');
}

function _normalizeSmartQuotes(text) {
  let res = text;
  for (const [bad, good] of Object.entries(SMART_QUOTE_MAP)) {
    res = res.replaceAll(bad, good);
  }
  return res;
}

function _fixPythonLiterals(text) {
  return text.replace(PY_LITERAL_RE, (_, match) => PY_LITERAL_MAP[match]);
}

/**
 * Best-effort repair for JSON cut off mid-stream (e.g. max_tokens exhausted).
 */
function _repairTruncated(text) {
  if (!text || (text[0] !== '{' && text[0] !== '[')) {
    return null;
  }

  const stack = [];
  let inStr = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if ((ch === '}' && top === '{') || (ch === ']' && top === '[')) {
          stack.pop();
        }
      }
    }
  }

  if (stack.length === 0 && !inStr) {
    return null; // Already balanced
  }

  let repaired = text;
  if (inStr) {
    repaired += '"';
  }
  const closers = { '{': '}', '[': ']' };
  while (stack.length > 0) {
    repaired += closers[stack.pop()];
  }
  return repaired;
}

function _tryParseVariants(candidate) {
  const attempts = [candidate];
  const fixed = _fixTrailingCommas(candidate);
  if (fixed !== candidate) {
    attempts.push(fixed);
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed !== null && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function _extractBalancedObject(text) {
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;

    let depth = 0;
    let inStr = false;
    let escape = false;

    for (let end = start; end < text.length; end++) {
      const ch = text[end];
      if (inStr) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.substring(start, end + 1);
          const obj = _tryParseVariants(candidate);
          if (obj !== null && typeof obj === 'object') {
            return obj;
          }
          break;
        }
      }
    }
  }
  return null;
}

export function safeParseLlmJson(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  let text = content.trim();
  text = _stripReasoningAndNoise(text);

  // 1. Gather fenced matches & plain candidate
  const fenceMatches = [];
  let m;
  const fenceRegex = new RegExp(CODE_FENCE_RE);
  while ((m = fenceRegex.exec(text)) !== null) {
    if (m[1]) fenceMatches.push(m[1].trim());
  }

  const candidates = [text, ...fenceMatches];

  for (let cand of candidates) {
    cand = _stripFence(cand.trim());
    if (!cand) continue;

    // 2. Direct parse
    let obj = _tryParseVariants(cand);
    if (obj !== null && typeof obj === 'object') return obj;

    // 3. Balanced-brace extraction
    obj = _extractBalancedObject(cand);
    if (obj !== null && typeof obj === 'object') return obj;

    // 4. Truncation repair
    const firstBrace = cand.indexOf('{');
    if (firstBrace !== -1) {
      const truncatedSlice = cand.substring(firstBrace);
      const repaired = _repairTruncated(truncatedSlice);
      if (repaired) {
        obj = _tryParseVariants(repaired) || _extractBalancedObject(repaired);
        if (obj !== null && typeof obj === 'object') {
          return obj;
        }
      }
    }
  }

  // 5. Aggressive sanitization pass (last resort)
  let sanitized = _normalizeSmartQuotes(text);
  sanitized = _fixPythonLiterals(sanitized);
  sanitized = _fixTrailingCommas(sanitized);

  let obj = _tryParseVariants(sanitized) || _extractBalancedObject(sanitized);
  if (obj !== null && typeof obj === 'object') {
    return obj;
  }

  const firstBrace = sanitized.indexOf('{');
  if (firstBrace !== -1) {
    const repaired = _repairTruncated(sanitized.substring(firstBrace));
    if (repaired) {
      obj = _tryParseVariants(repaired) || _extractBalancedObject(repaired);
      if (obj !== null && typeof obj === 'object') {
        return obj;
      }
    }
  }

  return null;
}

function _extractContentText(data) {
  try {
    const choices = data.choices || [];
    if (choices.length === 0) return null;
    const message = choices[0].message || {};
    const content = message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts = [];
      for (const part of content) {
        if (part && typeof part === 'object' && part.text) {
          parts.push(String(part.text));
        }
      }
      return parts.length > 0 ? parts.join('') : null;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public Chat Completion Entry Point
// ---------------------------------------------------------------------------

/**
 * Call Chat Completion using the priority-based Groq model pool.
 * 
 * @param {Object} options
 * @param {string} [options.apiKey] - Groq API Key (defaults to process.env.GROQ_API_KEY)
 * @param {Array<Object>} options.messages - Standard chat messages [{ role: 'user', content: '...' }]
 * @param {number} [options.temperature=0.7] - Sampling temperature
 * @param {number} [options.maxTokens=4096] - Max completion tokens
 * @param {number} [options.timeoutMs=120000] - Request timeout in ms
 * @param {Object} [options.responseFormat] - e.g. { type: 'json_object' }
 * @param {boolean} [options.requireJson=false] - If true, validates JSON content and falls back to next model on parse failure
 * @returns {Promise<Object>} API response object (with .parsed attached if requireJson=true)
 */
export async function callChatCompletion({
  apiKey,
  messages,
  temperature = 0.7,
  maxTokens = 4096,
  timeoutMs = 120000,
  responseFormat = null,
  requireJson = false
} = {}) {
  const effectiveApiKey = apiKey || process.env.GROQ_API_KEY;
  if (!effectiveApiKey) {
    throw new Error('Groq API Key is required (pass apiKey parameter or set GROQ_API_KEY in environment).');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array of message objects.');
  }

  const estimatedInput = estimateInputTokens(messages);
  let lastError = null;

  for (let attempt = 0; attempt < MODEL_POOL.length; attempt++) {
    const bucket = _state.selectModel(estimatedInput, maxTokens);
    if (!bucket) {
      break;
    }

    const spec = bucket.spec;
    const payload = {
      model: spec.name,
      messages,
      temperature,
      max_completion_tokens: Math.max(maxTokens, 1),
      stream: false
    };

    if (responseFormat) {
      payload.response_format = responseFormat;
    }
    if (spec.reasoning_effort !== null) {
      payload.reasoning_effort = spec.reasoning_effort;
    }
    if (spec.is_reasoning_model) {
      payload.include_reasoning = false;
    }

    const headers = {
      'Authorization': `Bearer ${effectiveApiKey}`,
      'Content-Type': 'application/json'
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);
      const status = response.status;

      if (status >= 400) {
        const errBody = await response.text().catch(() => '');
        console.warn(`[GroqPool] Model ${spec.name} returned HTTP ${status}: ${errBody.substring(0, 300)}`);
        _state.commitFailure(spec.name, status, null);
        lastError = new Error(`HTTP ${status} from ${spec.name}: ${errBody.substring(0, 300)}`);
        continue;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.warn(`[GroqPool] Model ${spec.name} envelope parse error:`, jsonErr.message);
        _state.commitFailure(spec.name, null, jsonErr);
        lastError = jsonErr;
        continue;
      }

      const usage = data.usage || {};
      const pt = parseInt(usage.prompt_tokens || 0, 10);
      const ct = parseInt(usage.completion_tokens || 0, 10);

      if (!Array.isArray(data.choices) || data.choices.length === 0) {
        console.warn(`[GroqPool] Model ${spec.name} returned no choices`);
        _state.commitFailure(spec.name, null, null);
        lastError = new Error(`Model ${spec.name} returned empty choices`);
        continue;
      }

      if (requireJson) {
        const content = _extractContentText(data);
        const parsed = content ? safeParseLlmJson(content) : null;

        if (parsed === null) {
          console.warn(`[GroqPool] Model ${spec.name}: requireJson=true but content could not be parsed as JSON. Falling back to next model. Preview: ${(content || '').substring(0, 200)}`);
          // Record token consumption
          _state.commitSuccess(spec.name, pt, ct);
          // Apply short parse failure cooldown
          _state.commitParseFailure(spec.name);
          lastError = new Error(`Model ${spec.name} returned invalid JSON content`);
          continue;
        }

        data.parsed = parsed;
      }

      // Success committed
      _state.commitSuccess(spec.name, pt, ct);
      return data;
    } catch (netErr) {
      clearTimeout(timer);
      console.warn(`[GroqPool] Model ${spec.name} transport error:`, netErr.message);
      _state.commitFailure(spec.name, null, netErr);
      lastError = netErr;
      continue;
    }
  }

  if (lastError !== null) {
    throw new Error(`All Groq models exhausted. Last error: ${lastError.message}`);
  }
  throw new Error('All Groq models currently unavailable or quota exhausted.');
}

export function getPoolStatus() {
  return _state.getStatus();
}

export function resetPool() {
  _state.reset();
}

export const GroqPoolService = {
  MODEL_POOL,
  ModelSpec,
  callChatCompletion,
  safeParseLlmJson,
  estimateInputTokens,
  getPoolStatus,
  resetPool
};

export default GroqPoolService;
