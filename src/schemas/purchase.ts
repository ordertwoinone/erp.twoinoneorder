import { z } from 'zod'

export const VAT_RATES = [
  { value: 0.05, label: '5%' },
  { value: 0, label: '0%' },
] as const

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  pack_size: z.coerce.number().min(0).optional().or(z.literal('')),
  quantity: z.coerce.number().gt(0, 'Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0, 'Price cannot be negative'),
  // Explicit `: boolean` — otherwise TS infers a type predicate and zod narrows
  // the output to 0 | 0.05, which no longer matches the form's input type.
  vat_rate: z.coerce.number().refine((v): boolean => v === 0 || v === 0.05, 'VAT must be 0% or 5%'),
  // Display-only metadata carried alongside the line for the New Purchase
  // page (from item search / previous purchases) — never sent to
  // save_purchase_draft beyond the fields above.
  product_name: z.string().optional(),
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

export const purchaseFormSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid('Select a restaurant'),
  supplier_id: z.string().uuid('Select a supplier'),
  invoice_number: z.string().trim().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  payment_terms_days: z.coerce.number().int().min(0).optional().or(z.literal('')),
  invoice_discount: z.coerce.number().min(0, 'Discount cannot be negative'),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(purchaseItemSchema).min(1, 'Add at least one line item'),
})
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>

const round2 = (n: number) => Math.round(n * 100) / 100

export interface LineTotals {
  gross: number
  discount: number
  vat: number
  total: number
}

/**
 * Spreads the invoice-level discount across lines in proportion to their
 * value (remainder on the last line so it sums exactly), then applies each
 * line's VAT rate to the discounted amount. The same maths runs on the
 * server (app.line_vat), so what's shown is what gets saved.
 */
export function computeLines(items: PurchaseItemInput[], invoiceDiscount: number): LineTotals[] {
  const gross = items.map((i) => round2((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)))
  const grossTotal = gross.reduce((a, b) => a + b, 0)
  const discountTotal = Math.min(Math.max(Number(invoiceDiscount) || 0, 0), grossTotal)

  let allocated = 0
  return items.map((item, index) => {
    let discount = 0
    if (grossTotal > 0 && discountTotal > 0) {
      discount = index === items.length - 1 ? round2(discountTotal - allocated) : round2((discountTotal * gross[index]) / grossTotal)
      allocated = round2(allocated + discount)
    }
    const vat = round2(Math.max(gross[index] - discount, 0) * (Number(item.vat_rate) || 0))
    return { gross: gross[index], discount, vat, total: round2(gross[index] - discount + vat) }
  })
}
