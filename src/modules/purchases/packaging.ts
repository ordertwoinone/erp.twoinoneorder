/**
 * Purchase packaging: a line is bought in a purchase unit (e.g. carton) that
 * holds N pieces, each of a given weight/volume. Stock is kept in the item's
 * stock unit, so every line converts:
 *   5 cartons x 6 pieces x 2 kg = 60 kg added to stock.
 * The rate can be quoted per purchase unit, per piece or per kg/l; it always
 * resolves to a price per purchase unit (unit_price), which drives the totals.
 */

export type PriceBasis = 'unit' | 'piece' | 'weight'

export interface UnitLike {
  id: string
  code: string
  name?: string
}

type Dimension = 'mass' | 'volume' | 'count'

/** Factor to the dimension's base (kg, l, piece). */
const MEASURES: Record<string, { dim: Dimension; toBase: number }> = {
  kg: { dim: 'mass', toBase: 1 },
  kgs: { dim: 'mass', toBase: 1 },
  g: { dim: 'mass', toBase: 0.001 },
  gm: { dim: 'mass', toBase: 0.001 },
  gms: { dim: 'mass', toBase: 0.001 },
  gram: { dim: 'mass', toBase: 0.001 },
  l: { dim: 'volume', toBase: 1 },
  ltr: { dim: 'volume', toBase: 1 },
  lt: { dim: 'volume', toBase: 1 },
  litre: { dim: 'volume', toBase: 1 },
  ml: { dim: 'volume', toBase: 0.001 },
  pc: { dim: 'count', toBase: 1 },
  pcs: { dim: 'count', toBase: 1 },
  piece: { dim: 'count', toBase: 1 },
  pieces: { dim: 'count', toBase: 1 },
  nos: { dim: 'count', toBase: 1 },
  no: { dim: 'count', toBase: 1 },
  ea: { dim: 'count', toBase: 1 },
  each: { dim: 'count', toBase: 1 },
}

export function measureOf(unit: UnitLike | undefined | null) {
  if (!unit) return null
  return MEASURES[unit.code.trim().toLowerCase()] ?? MEASURES[(unit.name ?? '').trim().toLowerCase()] ?? null
}

/** Units that can describe a piece's weight or volume (kg, g, l, ml). */
export function isWeightUnit(unit: UnitLike | undefined | null) {
  const m = measureOf(unit)
  return !!m && m.dim !== 'count'
}

const n = (v: unknown) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0)
const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp

export interface PackagingInput {
  quantity: unknown
  foc_quantity?: unknown
  pack_size?: unknown
  piece_weight?: unknown
  piece_weight_unit_id?: string | null
  price_basis?: PriceBasis | null
  basis_rate?: unknown
  unit_price?: unknown
}

export interface Packaging {
  piecesPerUnit: number
  /** Weight/volume of one piece, in the piece weight unit. */
  pieceWeight: number
  weightUnit: UnitLike | null
  /** Weight/volume of one purchase unit, in the piece weight unit. */
  weightPerUnit: number
  /** Stock units per purchase unit. */
  stockFactor: number
  /** True when the conversion to the stock unit is known (not a 1:1 guess). */
  converts: boolean
  unitsPurchased: number
  unitsReceived: number
  totalPieces: number
  totalWeight: number
  /** Stock added (paid + FOC) in the stock unit. */
  stockQuantity: number
}

export function computePackaging(
  item: PackagingInput,
  purchaseUnit: UnitLike | undefined | null,
  stockUnit: UnitLike | undefined | null,
  units: Map<string, UnitLike>,
): Packaging {
  const pieces = n(item.pack_size) > 0 ? n(item.pack_size) : 1
  const pieceWeight = n(item.piece_weight)
  const weightUnit = item.piece_weight_unit_id ? (units.get(item.piece_weight_unit_id) ?? null) : null
  const weightPerUnit = round(pieces * pieceWeight, 4)

  const pm = measureOf(purchaseUnit)
  const sm = measureOf(stockUnit)
  const wm = measureOf(weightUnit)

  let stockFactor = 1
  let converts = true
  if (purchaseUnit && stockUnit && purchaseUnit.id === stockUnit.id) {
    stockFactor = 1
  } else if (pm && sm && pm.dim === sm.dim) {
    // e.g. bought in g, stocked in kg.
    stockFactor = pm.toBase / sm.toBase
  } else if (sm && sm.dim !== 'count' && wm && wm.dim === sm.dim && pieceWeight > 0) {
    // Stocked by weight/volume: pieces x weight per piece.
    stockFactor = (pieces * pieceWeight * wm.toBase) / sm.toBase
  } else if (sm && sm.dim === 'count') {
    // Stocked by the piece.
    stockFactor = pieces
  } else if (n(item.pack_size) > 0) {
    stockFactor = pieces
  } else {
    converts = !stockUnit || !purchaseUnit
  }

  const unitsPurchased = n(item.quantity)
  const unitsReceived = unitsPurchased + n(item.foc_quantity)
  return {
    piecesPerUnit: pieces,
    pieceWeight,
    weightUnit,
    weightPerUnit,
    stockFactor: round(stockFactor, 6),
    converts,
    unitsPurchased,
    unitsReceived,
    totalPieces: round(unitsReceived * pieces, 3),
    totalWeight: round(unitsReceived * weightPerUnit, 3),
    stockQuantity: round(unitsReceived * stockFactor, 3),
  }
}

/** Price per purchase unit from a rate quoted on the chosen basis. */
export function unitPriceFromBasis(basis: PriceBasis, rate: number, pack: Pick<Packaging, 'piecesPerUnit' | 'weightPerUnit'>) {
  if (basis === 'piece') return round(rate * pack.piecesPerUnit, 4)
  if (basis === 'weight') return round(rate * pack.weightPerUnit, 4)
  return rate
}

/** Readable quantity, trimming trailing zeros: 60, 2.5, 0.125. */
export function qty(v: number) {
  return Number(round(v, 3)).toLocaleString('en-AE', { maximumFractionDigits: 3 })
}
