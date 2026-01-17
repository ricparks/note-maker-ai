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
import { AiResult, GeminiParams } from './types';
import { fetchWithTimeout, isTimeoutError } from './fetchWithTimeout';

export async function callGeminiClient(params: GeminiParams): Promise<AiResult> {
  const { base64Image, apiKey, model, prompt } = params;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const TIMEOUT_MS = 180000; // 3 minutes

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
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, TIMEOUT_MS);

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
    if (isTimeoutError(e)) {
      const timeoutSec = Math.round(TIMEOUT_MS / 1000);
      return { ok: false, error: `Gemini request timed out after ${timeoutSec}s`, errorType: 'network', cause: e, model };
    }
    return { ok: false, error: 'Network error contacting Gemini', errorType: 'network', cause: e, model };
  }
}
