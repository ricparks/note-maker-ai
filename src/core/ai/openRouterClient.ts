import { AiResult, OpenRouterParams } from './types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function parseOpenRouterJson(text: string): { ok: true; data: any } | { ok: false; error: unknown; raw: { text: string; candidates: string[] } } {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    const candidate = match[1]?.trim();
    if (candidate) candidates.push(candidate);
  }

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

export async function callOpenRouterClient(params: OpenRouterParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt, referer, clientTitle } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (typeof referer === 'string' && referer.length > 0) {
    headers['HTTP-Referer'] = referer;
  }
  if (typeof clientTitle === 'string' && clientTitle.length > 0) {
    headers['X-Title'] = clientTitle;
  }

  const body = {
    model,
    response_format: { type: 'json_object' },
    system:
      'You are BaseMaker. Respond with valid JSON only. Do not include markdown fences or explanations.',
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
    ],
  };

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorPayload: any = null;
      try { errorPayload = await response.json(); } catch {}
      return {
        ok: false,
        error: errorPayload?.error || `OpenRouter API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model,
      };
    }

    let parsed: any;
    try { parsed = await response.json(); } catch (cause) {
      return {
        ok: false,
        error: 'Failed to parse OpenRouter JSON body',
        errorType: 'parse',
        cause,
        model,
      };
    }

    const content = parsed?.choices?.[0]?.message?.content;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.find((chunk: any) => typeof chunk?.text === 'string')?.text
        : undefined;

    if (typeof text !== 'string') {
      return {
        ok: false,
        error: 'OpenRouter response missing text content',
        errorType: 'structure',
        raw: parsed,
        model,
      };
    }

    const parsedResult = parseOpenRouterJson(text);
    if (!parsedResult.ok) {
      return {
        ok: false,
        error: 'OpenRouter inner JSON parse error',
        errorType: 'parse',
        raw: { parsed, text, candidates: parsedResult.raw.candidates },
        cause: parsedResult.error,
        model,
      };
    }

    return { ok: true, data: parsedResult.data, raw: parsed, model };
  } catch (cause) {
    return {
      ok: false,
      error: 'Network error contacting OpenRouter',
      errorType: 'network',
      cause,
      model,
    };
  }
}
