// Matching scanned invoice lines to the catalogue: item code / barcode first,
// then the item name. Matches are suggestions shown on the review screen —
// the user confirms or changes every one before anything is added.

export interface MatchableProduct {
  id: string
  name: string
  sku: string | null
  barcode?: string | null
  base_unit_id: string
}

export interface MatchableUnit {
  id: string
  code: string
  name: string
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 1))

export type MatchKind = 'code' | 'name' | 'similar'

/** Best catalogue match for a scanned line, or null. */
export function matchProduct(
  products: MatchableProduct[],
  line: { sku: string | null; description: string },
): { product: MatchableProduct; kind: MatchKind } | null {
  const code = norm(line.sku)
  if (code) {
    const byCode = products.find((p) => norm(p.sku) === code || norm(p.barcode) === code)
    if (byCode) return { product: byCode, kind: 'code' }
  }
  const name = norm(line.description)
  if (!name) return null
  const byName = products.find((p) => norm(p.name) === name)
  if (byName) return { product: byName, kind: 'name' }

  // Word overlap (Jaccard) — catches "Puck Cooking Cream 10x1ltr" vs "Puck Cooking Cream".
  const target = words(line.description)
  let best: { product: MatchableProduct; score: number } | null = null
  for (const p of products) {
    const w = words(p.name)
    if (w.size === 0) continue
    let common = 0
    for (const x of w) if (target.has(x)) common++
    const score = common / (w.size + target.size - common)
    if (!best || score > best.score) best = { product: p, score }
  }
  return best && best.score >= 0.5 ? { product: best.product, kind: 'similar' } : null
}

// Invoice UOM abbreviations → unit codes seeded in the catalogue.
const UOM_ALIASES: Record<string, string> = {
  car: 'ctn', ctn: 'ctn', carton: 'ctn', cartons: 'ctn', cs: 'ctn', case: 'ctn',
  ea: 'pc', each: 'pc', pc: 'pc', pcs: 'pc', nos: 'pc', no: 'pc', unit: 'pc', piece: 'pc',
  kg: 'kg', kgs: 'kg', kilo: 'kg', g: 'g', gm: 'g', gms: 'g', gram: 'g',
  l: 'l', lt: 'l', ltr: 'l', litre: 'l', liter: 'l', ml: 'ml',
  box: 'box', bx: 'box', pack: 'pack', pkt: 'pack', packet: 'pack', bag: 'pack', bdl: 'pack', tray: 'pack', try: 'pack',
  btl: 'btl', bottle: 'btl',
}

/** The catalogue unit for a printed UOM (CAR, EA, KG…), or null when unknown. */
export function matchUnit(units: MatchableUnit[], uom: string | null | undefined): MatchableUnit | null {
  const key = norm(uom).replace(/ /g, '')
  if (!key) return null
  const direct = units.find((u) => norm(u.code) === key || norm(u.name) === key)
  if (direct) return direct
  const alias = UOM_ALIASES[key]
  return alias ? (units.find((u) => u.code === alias) ?? null) : null
}
