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
import { AiResult, OpenAIParams } from './types';
import { fetchWithTimeout, isTimeoutError } from './fetchWithTimeout';

export async function callOpenAIClient(params: OpenAIParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt } = params;
  const url = 'https://api.openai.com/v1/chat/completions';
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
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, TIMEOUT_MS);

    if (!response.ok) {
      let errorPayload: any = null;
      try { errorPayload = await response.json(); } catch {}
      return {
        ok: false,
        error: errorPayload?.error?.message || `OpenAI API HTTP ${response.status}`,
        errorType: 'api',
        raw: errorPayload,
        model
      };
    }

    let outer: any;
    try { outer = await response.json(); } catch (e) {
      return { ok: false, error: 'Failed to parse OpenAI JSON body', errorType: 'parse', cause: e, model };
    }

    const content = outer?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, error: 'OpenAI response missing content', errorType: 'structure', raw: outer, model };
    }

    try {
      const data = JSON.parse(content);
      return { ok: true, data, raw: outer, model };
    } catch (e) {
      return { ok: false, error: 'OpenAI inner JSON parse error', errorType: 'parse', raw: { outer, content }, cause: e, model };
    }
  } catch (e) {
    if (isTimeoutError(e)) {
      const timeoutSec = Math.round(TIMEOUT_MS / 1000);
      return { ok: false, error: `OpenAI request timed out after ${timeoutSec}s`, errorType: 'network', cause: e, model };
    }
    return { ok: false, error: 'Network error contacting OpenAI', errorType: 'network', cause: e, model };
  }
}
