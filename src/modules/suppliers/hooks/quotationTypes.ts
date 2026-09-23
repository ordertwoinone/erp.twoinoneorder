// Mirrors api/_lib/extractQuotation.ts's output shape. Kept as a separate
// copy rather than a shared import since src/ and api/ are built by
// different toolchains (Vite vs. Vercel's function bundler).
export interface ExtractedQuotationItem {
  description: string
  uom: string | null
  quantity: number
  unit_price: number
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedQuotation {
  supplier_name: string | null
  quotation_number: string | null
  quotation_date: string | null
  items: ExtractedQuotationItem[]
}
