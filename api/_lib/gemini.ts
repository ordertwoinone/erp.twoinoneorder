const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.8-flash'
const RETRY_DELAYS_MS = [2000, 5000, 10000]

type JsonSchema = Record<string, unknown>

/**
 * The extractors describe their output in JSON Schema (type arrays like
 * ["string", "null"], additionalProperties). Gemini's responseSchema uses the
 * OpenAPI subset instead: a single type plus `nullable`, and no
 * additionalProperties — so translate rather than maintain two schemas.
 */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const { additionalProperties: _ignored, type, properties, items, ...rest } = schema as {
    additionalProperties?: unknown
    type?: string | string[]
    properties?: Record<string, JsonSchema>
    items?: JsonSchema
  } & JsonSchema

  const out: JsonSchema = { ...rest }

  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== 'null')
    out.type = nonNull[0]
    if (type.includes('null')) out.nullable = true
  } else if (type) {
    out.type = type
  }

  if (properties) {
    out.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, toGeminiSchema(value)]))
  }
  if (items) out.items = toGeminiSchema(items)

  return out
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

export async function callGemini<T>({
  instructions,
  schema,
  parts,
}: {
  instructions: string
  schema: JsonSchema
  parts: GeminiPart[]
}): Promise<{ raw: unknown; parsed: T }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.')
  }

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: instructions }, ...parts] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
      temperature: 0,
    },
  })

  let model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  let { response, raw } = await generateWithRetry(apiKey, model, body, RETRY_DELAYS_MS)

  // Google retires model versions for new keys with little notice. Rather
  // than break every scan until the code is edited, retry on a model that's
  // actually available: the one Google names in the error, or the newest
  // Flash model this key can list.
  if (!response.ok && isModelUnavailable(response.status, raw)) {
    const replacement = suggestedModel(raw) ?? (await listFlashModels(apiKey)).find((m) => !m.endsWith('-lite')) ?? null
    if (replacement && replacement !== model) {
      console.warn(`Gemini model "${model}" unavailable, retrying with "${replacement}"`)
      model = replacement
      ;({ response, raw } = await generateWithRetry(apiKey, model, body, RETRY_DELAYS_MS))
    }
  }

  // Still overloaded after backing off: a busy model is usually busy for
  // everyone on it, so a different Flash model tends to get through.
  if (!response.ok && isTransient(response.status, raw)) {
    const fallback =
      process.env.GEMINI_FALLBACK_MODEL || (await listFlashModels(apiKey)).find((m) => m !== model) || null
    if (fallback && fallback !== model) {
      console.warn(`Gemini model "${model}" overloaded, falling back to "${fallback}"`)
      model = fallback
      ;({ response, raw } = await generateWithRetry(apiKey, model, body, [3000]))
    }
  }

  if (!response.ok) {
    const message: string = raw?.error?.message || `Gemini request failed with status ${response.status}`
    if (response.status === 429) {
      throw new Error(
        `Gemini usage limit reached for this API key (${message}). Wait a minute and retry; if it keeps happening, check the key's quota/billing in Google AI Studio.`,
      )
    }
    if (isTransient(response.status, raw)) {
      throw new Error('Google Gemini is busy right now (high demand). Please try the scan again in a minute.')
    }
    throw new Error(`Gemini (${model}): ${message}`)
  }

  const candidate = raw?.candidates?.[0]
  const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
  if (!text) {
    const reason = candidate?.finishReason || raw?.promptFeedback?.blockReason || 'no content returned'
    throw new Error(`Gemini did not return a result (${reason}).`)
  }

  try {
    return { raw, parsed: JSON.parse(text) as T }
  } catch {
    throw new Error('Gemini returned output that was not valid JSON.')
  }
}

async function generate(apiKey: string, model: string, body: string) {
  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body,
  })
  const raw = (await response.json().catch(() => null)) as any
  return { response, raw }
}

/** Retries the same model on transient overload/rate errors, waiting between attempts. */
async function generateWithRetry(apiKey: string, model: string, body: string, delaysMs: number[]) {
  let result = await generate(apiKey, model, body)
  for (const delay of delaysMs) {
    if (result.response.ok || !isTransient(result.response.status, result.raw)) break
    await new Promise((resolve) => setTimeout(resolve, delay))
    result = await generate(apiKey, model, body)
  }
  return result
}

/** "High demand", overloaded (503), internal hiccups (500) and rate limits (429) — all worth retrying. */
function isTransient(status: number, raw: any): boolean {
  const message: string = raw?.error?.message ?? ''
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    /high demand|overloaded|try again later|\bunavailable\b/i.test(message)
  )
}

function isModelUnavailable(status: number, raw: any): boolean {
  const message: string = raw?.error?.message ?? ''
  return status === 404 || /no longer available|not found|is not supported|deprecated/i.test(message)
}

/** Google's retirement errors name the replacement, e.g. "...use models/gemini-3.8-flash for...". */
function suggestedModel(raw: any): string | null {
  const message: string = raw?.error?.message ?? ''
  const match = message.match(/use\s+models\/([a-z0-9][\w.-]*)/i)
  return match ? match[1] : null
}

/** Flash models this key can use, newest version first, full Flash before Flash-Lite. */
async function listFlashModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${GEMINI_API_BASE}?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } })
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { models?: { name: string; supportedGenerationMethods?: string[] }[] } | null
  const version = (name: string) => parseFloat(name.slice('gemini-'.length))
  return (data?.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((name) => /^gemini-[\d.]+-flash(-lite)?$/.test(name))
    .sort((a, b) => version(b) - version(a) || Number(a.endsWith('-lite')) - Number(b.endsWith('-lite')))
}

/** A PDF or image file, sent inline alongside the instructions. */
export function fileParts(base64Data: string, mimeType: string): GeminiPart[] {
  return [{ inline_data: { mime_type: mimeType, data: base64Data } }]
}
