export type AiErrorType = 'network' | 'api' | 'parse' | 'structure' | 'unknown';

export interface AiSuccess {
  ok: true;
  data: any;      // Parsed JSON object returned by the model
  raw: any;       // Raw response JSON (already parsed from response.json())
  model?: string; // Model identifier used
}

export interface AiFailure {
  ok: false;
  error: string;      // Human readable error message (no UI side-effects here)
  errorType: AiErrorType;
  raw?: any;          // Raw partial response for debugging
  cause?: unknown;    // Underlying thrown value
  model?: string;
}

export type AiResult = AiSuccess | AiFailure;

/**
 * BaseLLMParams captures the shared required inputs for all LLM image→JSON calls.
 * vendor-specific interfaces extend this to add discriminants or extra tuning fields later
 * (e.g., temperature, safety settings, response_format overrides, etc.).
 */
export interface BaseLLMParams {
  /** base64 encoded (without data: prefix) JPEG/PNG image */
  base64Image: string;
  /** API key for the target vendor */
  apiKey: string;
  /** Model identifier (e.g., gpt-4o, gemini-2.5-pro) */
  model: string;
  /** User/system prompt guiding the vision + JSON extraction */
  prompt: string;
}

/**
 * Parameters specific to OpenAI vision chat completion requests.
 * Currently no additional fields, but reserved for future vendor-specific tuning.
 */
export interface OpenAIParams extends BaseLLMParams {
  vendor: 'openai';
  // future: temperature?: number; responseFormat?: 'json_object' | 'text';
}

/**
 * Parameters specific to Gemini vision content generation.
 */
export interface GeminiParams extends BaseLLMParams {
  vendor: 'gemini';
  // future: safetySettings?: any; generationConfig?: Record<string, unknown>;
}

/**
 * Parameters specific to OpenRouter chat completions.
 */
export interface OpenRouterParams extends BaseLLMParams {
  vendor: 'openrouter';
  /** Optional origin and title headers improve OpenRouter telemetry transparency. */
  referer?: string;
  clientTitle?: string;
}
