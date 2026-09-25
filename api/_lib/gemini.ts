const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'

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

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: instructions }, ...parts] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
        temperature: 0,
      },
    }),
  })

  const raw = (await response.json().catch(() => null)) as any
  if (!response.ok) {
    const message = raw?.error?.message || `Gemini request failed with status ${response.status}`
    throw new Error(`Gemini: ${message}`)
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

/** A PDF or image file, sent inline alongside the instructions. */
export function fileParts(base64Data: string, mimeType: string): GeminiPart[] {
  return [{ inline_data: { mime_type: mimeType, data: base64Data } }]
}
