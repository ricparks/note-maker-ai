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
import { AiResult, OpenAIParams } from './types';

interface OpenAIErrorPayload {
  error?: { message?: string };
}

interface OpenAIMessage {
  content?: string;
}

interface OpenAIChoice {
  message?: OpenAIMessage;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

export async function callOpenAIClient(params: OpenAIParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt } = params;
  const TIMEOUT_MS = 180000; // 3 minutes

  const requestBody = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
          }
        ]
      }
    ]
  };

  try {
    const requestParams: RequestUrlParam = {
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
      let errorPayload: OpenAIErrorPayload | null = null;
      try { errorPayload = response.json as OpenAIErrorPayload; } catch { /* ignore parse errors */ }
      return {
        ok: false,
        error: errorPayload?.error?.message ?? `OpenAI API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model
      };
    }

    let outer: OpenAIResponse;
    try { outer = response.json as OpenAIResponse; } catch (e) {
      return { ok: false, error: 'Failed to parse OpenAI JSON body', errorType: 'parse', cause: e, model };
    }

    const content = outer?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, error: 'OpenAI response missing content', errorType: 'structure', raw: outer, model };
    }

    try {
      const data = JSON.parse(content) as unknown;
      return { ok: true, data, raw: outer, model };
    } catch (e) {
      return { ok: false, error: 'OpenAI inner JSON parse error', errorType: 'parse', raw: { outer, content }, cause: e, model };
    }
  } catch (e) {
    const causeError = e instanceof Error ? e : null;
    if (causeError?.name === 'AbortError') {
      const timeoutSec = Math.round(TIMEOUT_MS / 1000);
      return { ok: false, error: `OpenAI request timed out after ${timeoutSec}s`, errorType: 'network', cause: e, model };
    }
    return { ok: false, error: 'Network error contacting OpenAI', errorType: 'network', cause: e, model };
  }
}
