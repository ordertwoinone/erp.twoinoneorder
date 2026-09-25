/**
 * Parses a /api/* response. When the function crashes or times out, Vercel
 * answers with a plain-text page ("A server error has occurred") instead of
 * JSON, so response.json() alone surfaces a meaningless parse error.
 */
export async function readApiResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const text = await response.text()
  let body: (T & { error?: string }) | null = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }

  if (!response.ok || body === null) {
    if (body?.error) throw new Error(body.error)
    if (response.status === 504 || /timeout|timed out/i.test(text)) {
      throw new Error('The scan took too long and timed out. Try a smaller or clearer file, or scan fewer pages at a time.')
    }
    throw new Error(`${fallbackError} (server returned ${response.status}${text ? `: ${text.slice(0, 120)}` : ''})`)
  }

  return body
}
