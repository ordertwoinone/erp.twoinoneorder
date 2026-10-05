import { z } from 'zod'

export const VAT_RATES = [
  { value: 0.05, label: '5%' },
  { value: 0, label: '0%' },
] as const

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const

export const PURCHASE_CURRENCIES = ['AED', 'USD', 'EUR', 'INR', 'EGP'] as const

const optionalAmount = z.union([z.literal(''), z.coerce.number().min(0, 'Cannot be negative')]).optional()

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  pack_size: z.coerce.number().min(0).optional().or(z.literal('')),
  quantity: z.coerce.number().gt(0, 'Quantity must be greater than 0'),
  /** Free-of-charge quantity received on top of `quantity` (not billed). */
  foc_quantity: optionalAmount,
  /** Price per unit in AED — always the value saved and used for totals. */
  unit_price: z.coerce.number().min(0, 'Price cannot be negative'),
  /** Price per unit in the invoice currency, when that isn't AED. */
  foreign_unit_price: optionalAmount,
  /** Discount per unit (AED), on top of the bill discount. */
  unit_discount: optionalAmount,
  // Explicit `: boolean` — otherwise TS infers a type predicate and zod narrows
  // the output to 0 | 0.05, which no longer matches the form's input type.
  vat_rate: z.coerce.number().refine((v): boolean => v === 0 || v === 0.05, 'VAT must be 0% or 5%'),
  // Display-only metadata carried alongside the line for the New Purchase
  // page (from item search / previous purchases) — never sent to
  // save_purchase_draft beyond the fields above.
  product_name: z.string().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  image_path: z.string().nullable().optional(),
  brand_name: z.string().optional(),
  pack_label: z.string().optional(),
  size_label: z.string().optional(),
  category_name: z.string().optional(),
  unit_code: z.string().optional(),
  agreed_price: z.number().nullable().optional(),
  agreed_unit_id: z.string().nullable().optional(),
  last_purchase_price: z.number().nullable().optional(),
})
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>

export const purchaseExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Describe the expense'),
  payee: z.string().optional().or(z.literal('')),
  amount: z.union([z.literal(''), z.coerce.number().min(0, 'Cannot be negative')]).refine((v): boolean => v !== '', 'Enter the amount'),
})
export type PurchaseExpenseInput = z.infer<typeof purchaseExpenseSchema>

export const purchaseFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  supplier_id: z.string().uuid('Select a supplier'),
  invoice_number: z.string().trim().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  received_date: z.string().optional().or(z.literal('')),
  payment_mode: z.string().optional().or(z.literal('')),
  payment_terms_days: z.coerce.number().int().min(0).optional().or(z.literal('')),
  po_reference: z.string().optional().or(z.literal('')),
  tax_disabled: z.boolean(),
  currency_code: z.enum(PURCHASE_CURRENCIES),
  exchange_rate: z.coerce.number().gt(0, 'Enter the exchange rate'),
  /** Bill discount in AED. Ignored when a percentage is set. */
  invoice_discount: z.coerce.number().min(0, 'Discount cannot be negative'),
  bill_discount_percent: z.union([z.literal(''), z.coerce.number().min(0).max(100, 'Max 100%')]).optional(),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseItemSchema).min(1, 'Add at least one line item'),
  expenses: z.array(purchaseExpenseSchema),
})
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (v === '' || v === undefined || v === null ? 0 : Number(v) || 0)

export interface LineTotals {
  /** quantity × unit price */
  gross: number
  /** unit discount × quantity */
  lineDiscount: number
  /** this line's share of the bill discount */
  billDiscount: number
  /** lineDiscount + billDiscount — what's saved as discount_amount */
  discount: number
  /** gross − discount (before VAT) */
  net: number
  vat: number
  total: number
  /** Cost per unit received (paid + FOC), including a share of other expenses. Null when nothing is received. */
  landingCost: number | null
}

export interface InvoiceTotals {
  gross: number
  lineDiscount: number
  billDiscount: number
  net: number
  vat: number
  total: number
  expenses: number
}

/** The bill discount actually applied: the % of (gross − line discounts) when a % is set, otherwise the amount. */
export function effectiveBillDiscount(items: PurchaseItemInput[], amount: unknown, percent: unknown): number {
  const base = items.reduce((s, i) => s + round2(num(i.quantity) * num(i.unit_price)) - round2(num(i.unit_discount) * num(i.quantity)), 0)
  if (percent !== '' && percent !== undefined && percent !== null) return round2((Math.max(base, 0) * num(percent)) / 100)
  return num(amount)
}

/**
 * Per-line totals. Unit discounts come off each line first; the bill
 * discount is then spread across lines in proportion to their value
 * (remainder on the last line so it sums exactly); VAT is each line's rate on
 * what's left (0 when tax is disabled). The same maths runs on the server
 * (app.line_vat), so what's shown is what gets saved.
 */
export function computeLines(items: PurchaseItemInput[], billDiscount: number, options: { taxDisabled?: boolean; otherExpenses?: number } = {}): LineTotals[] {
  const gross = items.map((i) => round2(num(i.quantity) * num(i.unit_price)))
  const lineDiscount = items.map((i, idx) => Math.min(round2(num(i.unit_discount) * num(i.quantity)), gross[idx]))
  const afterLine = gross.map((g, idx) => round2(g - lineDiscount[idx]))
  const base = afterLine.reduce((a, b) => a + b, 0)
  const billTotal = Math.min(Math.max(num(billDiscount), 0), base)

  let allocated = 0
  const partial = items.map((item, index) => {
    let bill = 0
    if (base > 0 && billTotal > 0) {
      bill = index === items.length - 1 ? round2(billTotal - allocated) : round2((billTotal * afterLine[index]) / base)
      allocated = round2(allocated + bill)
    }
    const discount = round2(lineDiscount[index] + bill)
    const net = round2(Math.max(gross[index] - discount, 0))
    const vat = options.taxDisabled ? 0 : round2(net * num(item.vat_rate))
    return { gross: gross[index], lineDiscount: lineDiscount[index], billDiscount: bill, discount, net, vat, total: round2(net + vat) }
  })

  const netTotal = partial.reduce((s, l) => s + l.net, 0)
  const other = num(options.otherExpenses)
  return partial.map((l, index) => {
    const received = num(items[index].quantity) + num(items[index].foc_quantity)
    const share = netTotal > 0 ? (other * l.net) / netTotal : 0
    return { ...l, landingCost: received > 0 ? Math.round(((l.net + share) / received) * 10000) / 10000 : null }
  })
}

export function sumLines(lines: LineTotals[], otherExpenses: number): InvoiceTotals {
  const sum = (k: keyof Omit<LineTotals, 'landingCost'>) => round2(lines.reduce((s, l) => s + l[k], 0))
  return {
    gross: sum('gross'),
    lineDiscount: sum('lineDiscount'),
    billDiscount: sum('billDiscount'),
    net: sum('net'),
    vat: sum('vat'),
    total: sum('total'),
    expenses: round2(num(otherExpenses)),
  }
}
