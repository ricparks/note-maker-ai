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
import { AiResult, AnthropicParams } from './types';
import { isTimeoutError } from './fetchWithTimeout';

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

const TIMEOUT_MS = 180000; // 3 minutes

export async function callAnthropicClient(params: AnthropicParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': DEFAULT_ANTHROPIC_VERSION,
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
    const requestParams: RequestUrlParam = {
      url: ANTHROPIC_ENDPOINT,
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      throw: false,
    };

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const error: any = new Error("Request timed out");
        error.name = "AbortError"; // Mimic DOMException for compatibility if check uses that
        reject(error);
      }, TIMEOUT_MS);
    });

    // Use requestUrl to bypass CORS (runs in Node context in Obsidian)
    const response = (await Promise.race([
      requestUrl(requestParams),
      timeoutPromise,
    ])) as any;

    if (response.status >= 400) {
      const errorPayload = response.json;
      return {
        ok: false,
        error: errorPayload?.error?.message || `Anthropic API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model,
      };
    }

    let parsed: any;
    try {
      parsed = response.json;
    } catch (cause) {
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
    if (isTimeoutError(cause) || (cause as any).name === 'AbortError') {
      const timeoutSec = Math.round(TIMEOUT_MS / 1000);
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
