/**
 * Matching a person read from a MOHRE labour list to an existing employee.
 *
 * Identity numbers win (passport, MOHRE person code, work permit / card
 * number, Emirates ID) — a hit on any of those is a sure match. Otherwise the
 * name is compared loosely, because lists and our records spell names
 * differently ("KHUSH MAHAMAD MANSURI" vs "KHUSH MOHAMAD MANSURI") or carry
 * extra parts ("BARUN KUMAR SHAH" vs "BARUN KUMAR"). A name-only match is
 * only ever "uncertain" so a person reviews it.
 */

export interface EmployeeForMatch {
  id: string
  full_name: string
  passport_number: string | null
  labour_person_number: string | null
  work_permit_number: string | null
  emirates_id: string | null
}

export interface PersonForMatch {
  person_name: string
  passport_number?: string | null
  person_code?: string | null
  card_number?: string | null
  civil_id_number?: string | null
}

export type MatchResult = { employee: EmployeeForMatch; status: 'matched' | 'uncertain'; reason: string } | null

/** Uppercase letters and digits only — "PA 0623652" and "pa0623652" compare equal. */
export const normalizeId = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const nameTokens = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)

function editDistance(a: string, b: string) {
  if (a === b) return 0
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/** Same word allowing a typo-sized difference for longer words (MAHAMAD ~ MOHAMAD). */
function sameWord(a: string, b: string) {
  if (a === b) return true
  const len = Math.min(a.length, b.length)
  if (len < 4) return false
  return editDistance(a, b) <= (len >= 7 ? 2 : 1)
}

/**
 * 0–1: how well two names agree. Every word of the shorter name must appear
 * (loosely) in the longer one, and at least two words must match, so a single
 * shared first name never counts.
 */
export function nameSimilarity(a: string, b: string) {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  if (!ta.length || !tb.length) return 0
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  const used = new Set<number>()
  let matched = 0
  for (const word of short) {
    const idx = long.findIndex((w, i) => !used.has(i) && sameWord(word, w))
    if (idx === -1) return 0
    used.add(idx)
    matched++
  }
  if (matched < 2) return 0
  return matched / long.length
}

export function matchEmployee(person: PersonForMatch, employees: EmployeeForMatch[]): MatchResult {
  const ids: [keyof EmployeeForMatch, string, string][] = [
    ['passport_number', normalizeId(person.passport_number), 'passport number'],
    ['labour_person_number', normalizeId(person.person_code), 'MOHRE person code'],
    ['work_permit_number', normalizeId(person.card_number), 'work permit number'],
    ['emirates_id', normalizeId(person.civil_id_number), 'Emirates ID'],
  ]
  for (const [field, value, reason] of ids) {
    if (value.length < 5) continue
    const hit = employees.find((e) => normalizeId(e[field] as string | null) === value)
    if (hit) return { employee: hit, status: 'matched', reason }
  }

  let best: { employee: EmployeeForMatch; score: number } | null = null
  let tie = false
  for (const e of employees) {
    const score = nameSimilarity(person.person_name, e.full_name)
    if (score === 0) continue
    if (!best || score > best.score) {
      best = { employee: e, score }
      tie = false
    } else if (score === best.score) {
      tie = true
    }
  }
  // Two equally good candidates: don't guess.
  if (!best || tie) return null
  return { employee: best.employee, status: 'uncertain', reason: 'similar name' }
}
