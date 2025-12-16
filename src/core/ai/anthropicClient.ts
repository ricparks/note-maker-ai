import { AiResult, AnthropicParams } from './types';
import { fetchWithTimeout, isTimeoutError } from './fetchWithTimeout';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

/**
 * Parse JSON from Anthropic response text.
 * Handles potential markdown fences that some models may include.
 */
function parseAnthropicJson(text: string): { ok: true; data: any } | { ok: false; error: unknown; raw: { text: string; candidates: string[] } } {
  const trimmed = text.trim();
  const candidates: string[] = [];

  // Extract content from markdown code fences if present
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    const candidate = match[1]?.trim();
    if (candidate) candidates.push(candidate);
  }

  // Also try the raw text
  if (candidates.length === 0) {
    candidates.push(trimmed);
  } else if (!candidates.includes(trimmed)) {
    candidates.push(trimmed);
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);
      return { ok: true, data };
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: false, error: lastError, raw: { text, candidates } };
}

export async function callAnthropicClient(params: AnthropicParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt, anthropicVersion, timeoutMs } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': anthropicVersion || DEFAULT_ANTHROPIC_VERSION,
  };

  // Anthropic Messages API request body
  // Using the prefill technique to encourage JSON output
  const requestBody = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: '{' }], // Prefill to encourage JSON output
      },
    ],
  };

  try {
    const response = await fetchWithTimeout(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    }, timeoutMs);

    if (!response.ok) {
      let errorPayload: any = null;
      try { errorPayload = await response.json(); } catch {}
      return {
        ok: false,
        error: errorPayload?.error?.message || `Anthropic API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model,
      };
    }

    let parsed: any;
    try { parsed = await response.json(); } catch (cause) {
      return {
        ok: false,
        error: 'Failed to parse Anthropic JSON body',
        errorType: 'parse',
        cause,
        model,
      };
    }

    // Anthropic response structure: content[0].text
    const content = parsed?.content;
    const textBlock = Array.isArray(content)
      ? content.find((block: any) => block.type === 'text')
      : null;
    const text = textBlock?.text;

    if (typeof text !== 'string') {
      return {
        ok: false,
        error: 'Anthropic response missing text content',
        errorType: 'structure',
        raw: parsed,
        model,
      };
    }

    // Prepend the '{' we used as prefill since it's not in the response
    const fullJson = '{' + text;
    const parsedResult = parseAnthropicJson(fullJson);
    
    if (!parsedResult.ok) {
      return {
        ok: false,
        error: 'Anthropic inner JSON parse error',
        errorType: 'parse',
        raw: { parsed, text: fullJson, candidates: parsedResult.raw.candidates },
        cause: parsedResult.error,
        model,
      };
    }

    return { ok: true, data: parsedResult.data, raw: parsed, model };
  } catch (cause) {
    if (isTimeoutError(cause)) {
      const timeoutSec = timeoutMs ? Math.round(timeoutMs / 1000) : 0;
      return {
        ok: false,
        error: `Anthropic request timed out after ${timeoutSec}s`,
        errorType: 'network',
        cause,
        model,
      };
    }
    return {
      ok: false,
      error: 'Network error contacting Anthropic',
      errorType: 'network',
      cause,
      model,
    };
  }
}
