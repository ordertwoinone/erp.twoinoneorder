export type StockDocKind = 'purchase_return' | 'wastage' | 'adjustment' | 'request' | 'transfer'

export interface StockDocConfig {
  kind: StockDocKind
  title: string
  singular: string
  path: string
  /** Header field label for the location picker(s). */
  twoLocations: boolean
  /** Column header for the counterparty column in the list. */
  counterpartyLabel: string | null
  totalLabel: string
  permission: string
}

export const stockDocConfig: Record<StockDocKind, StockDocConfig> = {
  purchase_return: {
    kind: 'purchase_return',
    title: 'Purchase Returns',
    singular: 'Purchase Return',
    path: '/inventory/purchase-returns',
    twoLocations: false,
    counterpartyLabel: 'Vendor',
    totalLabel: 'Net Total',
    permission: 'purchases.create',
  },
  wastage: {
    kind: 'wastage',
    title: 'Wastage',
    singular: 'Wastage',
    path: '/inventory/wastage',
    twoLocations: false,
    counterpartyLabel: 'Type',
    totalLabel: 'Amount',
    permission: 'inventory.manage',
  },
  adjustment: {
    kind: 'adjustment',
    title: 'Stock Adjustments',
    singular: 'Stock Adjustment',
    path: '/inventory/adjustments',
    twoLocations: false,
    counterpartyLabel: null,
    totalLabel: 'Adj. Value',
    permission: 'inventory.manage',
  },
  request: {
    kind: 'request',
    title: 'Stock Requests',
    singular: 'Stock Transfer Request',
    path: '/inventory/requests',
    twoLocations: true,
    counterpartyLabel: 'To',
    totalLabel: 'Requested Cost',
    permission: 'inventory.manage',
  },
  transfer: {
    kind: 'transfer',
    title: 'Stock Transfers',
    singular: 'Stock Transfer',
    path: '/inventory/transfers',
    twoLocations: true,
    counterpartyLabel: 'To',
    totalLabel: 'Transferring Cost',
    permission: 'inventory.manage',
  },
}

/** Statuses that can still be edited (drafts and open requests). */
export function isEditableStatus(status: string | null | undefined) {
  return !status || status === 'draft' || status === 'open'
}

export const statusLabel: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  posted: 'Posted',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  received: 'Received',
}

export interface DocLine {
  key: string
  product_id: string
  unit_id: string
  product_name: string
  sku: string | null
  barcode: string | null
  unit_code: string
  pack_size: number | null
  current_stock: number
  quantity: number
  foc_quantity: number
  unit_cost: number
  current_cost: number
  tax_percent: number
  discount_amount: number
  /** Adjustments: the counted stock. */
  new_stock: number
  remarks: string
}

export interface DocHeader {
  id?: string
  doc_number?: string
  status?: string
  restaurant_id: string
  from_restaurant_id: string
  to_restaurant_id: string
  supplier_id: string
  invoice_number: string
  doc_date: string
  received_date: string
  payment_mode: string
  tax_disabled: boolean
  discount_percent: number
  discount_amount: number
  notes: string
  item_kind: 'material' | 'food_product'
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Line maths shared by the grid and the totals footer (mirrors the server). */
export function lineValues(kind: StockDocKind, line: DocLine, taxDisabled: boolean) {
  if (kind === 'purchase_return') {
    const amount = round2(line.quantity * line.unit_cost - line.discount_amount)
    const tax = taxDisabled ? 0 : round2((amount * line.tax_percent) / 100)
    return { amount, tax, total: amount + tax }
  }
  if (kind === 'adjustment') {
    const adjustment = line.new_stock - line.current_stock
    return { amount: round2(adjustment * line.unit_cost), tax: 0, total: round2(adjustment * line.unit_cost), adjustment }
  }
  const amount = round2(line.quantity * line.unit_cost)
  return { amount, tax: 0, total: amount }
}

export function documentTotals(kind: StockDocKind, header: DocHeader, lines: DocLine[]) {
  let subtotal = 0
  let tax = 0
  let quantity = 0
  for (const l of lines) {
    const v = lineValues(kind, l, header.tax_disabled)
    subtotal += v.amount
    tax += v.tax
    quantity += l.quantity
  }
  subtotal = round2(subtotal)
  const discount =
    kind === 'purchase_return'
      ? header.discount_percent > 0
        ? round2((subtotal * header.discount_percent) / 100)
        : header.discount_amount
      : 0
  if (subtotal > 0 && discount > 0) tax = round2(tax * (1 - discount / subtotal))
  return { subtotal, discount, tax: round2(tax), net: round2(subtotal - discount + tax), quantity }
}
