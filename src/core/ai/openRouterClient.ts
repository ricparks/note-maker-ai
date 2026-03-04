/*
 * Copyright (C) 2026 The Application Foundry, LLC
 *
 * This file is part of NoteMakerAI.
 *
 * NoteMakerAI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NoteMakerAI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * =========================================================================
 *
 * COMMERCIAL LICENSE OPTION
 *
 * If you wish to use this software in a proprietary product or are unable
 * to comply with the terms of the AGPLv3, a commercial license is available.
 *
 * For commercial licensing inquiries, please contact: license@theapplicationfoundry.com
 *
 * =========================================================================
 */
import { requestUrl, RequestUrlParam } from 'obsidian';
import { AiResult, OpenRouterParams } from './types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 180000; // 3 minutes

interface OpenRouterErrorPayload {
  error?: string;
}

interface OpenRouterContentChunk {
  text?: string;
}

interface OpenRouterMessage {
  content?: string | OpenRouterContentChunk[];
}

interface OpenRouterChoice {
  message?: OpenRouterMessage;
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

function parseOpenRouterJson(text: string): { ok: true; data: unknown } | { ok: false; error: unknown; raw: { text: string; candidates: string[] } } {
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
      const data = JSON.parse(candidate) as unknown;
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
      'You are NoteMakerAI. Respond with valid JSON only. Do not include markdown fences or explanations.',
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
    const requestParams: RequestUrlParam = {
      url: OPENROUTER_ENDPOINT,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      throw: false,
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error('Request timed out');
        error.name = 'AbortError';
        reject(error);
      }, TIMEOUT_MS);
    });

    const response = await Promise.race([
      requestUrl(requestParams),
      timeoutPromise,
    ]);

    if (response.status >= 400) {
      let errorPayload: OpenRouterErrorPayload | null = null;
      try { errorPayload = response.json as OpenRouterErrorPayload; } catch { /* ignore parse errors */ }
      return {
        ok: false,
        error: errorPayload?.error ?? `OpenRouter API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model,
      };
    }

    let parsed: OpenRouterResponse;
    try { parsed = response.json as OpenRouterResponse; } catch (cause) {
      return {
        ok: false,
        error: 'Failed to parse OpenRouter JSON body',
        errorType: 'parse',
        cause,
        model,
      };
    }

    const messageContent = parsed?.choices?.[0]?.message?.content;
    const text = typeof messageContent === 'string'
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent.find((chunk: OpenRouterContentChunk) => typeof chunk?.text === 'string')?.text
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
    const causeError = cause instanceof Error ? cause : null;
    if (causeError?.name === 'AbortError') {
      const timeoutSec = Math.round(TIMEOUT_MS / 1000);
      return {
        ok: false,
        error: `OpenRouter request timed out after ${timeoutSec}s`,
        errorType: 'network',
        cause,
        model,
      };
    }
    return {
      ok: false,
      error: 'Network error contacting OpenRouter',
      errorType: 'network',
      cause,
      model,
    };
  }
}
