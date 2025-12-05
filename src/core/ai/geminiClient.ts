import { AiResult, GeminiParams } from './types';

export async function callGeminiClient(params: GeminiParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt } = params; // vendor field unused for now
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: { response_mime_type: 'application/json' }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorPayload: any = null;
      try { errorPayload = await response.json(); } catch {}
      return {
        ok: false,
        error: errorPayload?.error?.message || `Gemini API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model
      };
    }

    let outer: any;
    try { outer = await response.json(); } catch (e) {
      return { ok: false, error: 'Failed to parse Gemini JSON body', errorType: 'parse', cause: e, model };
    }

    const text = outer?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      return { ok: false, error: 'Gemini response missing text content', errorType: 'structure', raw: outer, model };
    }

    try {
      const data = JSON.parse(text);
      return { ok: true, data, raw: outer, model };
    } catch (e) {
      return { ok: false, error: 'Gemini inner JSON parse error', errorType: 'parse', raw: { outer, text }, cause: e, model };
    }
  } catch (e) {
    return { ok: false, error: 'Network error contacting Gemini', errorType: 'network', cause: e, model };
  }
}
