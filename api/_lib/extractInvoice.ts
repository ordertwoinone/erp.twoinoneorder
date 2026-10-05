import { callGemini, fileParts } from './gemini.js'

export interface ExtractedInvoiceItem {
  description: string
  sku: string | null
  uom: string | null
  pack_size: number | null
  quantity: number
  unit_price: number
  /** Line discount amount (not per unit), 0 when the column shows 0. */
  discount: number | null
  amount_before_vat: number | null
  vat_percent: number | null
  vat_amount: number | null
  amount_including_vat: number | null
  confidence: number
  is_uncertain: boolean
}

export interface ExtractedInvoice {
  supplier_name: string | null
  supplier_trn: string | null
  invoice_number: string | null
  invoice_date: string | null
  lpo_number: string | null
  total_discount: number | null
  total_before_vat: number | null
  total_vat: number | null
  grand_total: number | null
  items: ExtractedInvoiceItem[]
}

const money = (description: string) => ({ type: ['number', 'null'], description })

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    supplier_name: { type: ['string', 'null'] },
    supplier_trn: { type: ['string', 'null'], description: "The supplier's (seller's) VAT TRN, not the customer's" },
    invoice_number: { type: ['string', 'null'] },
    invoice_date: { type: ['string', 'null'], description: 'ISO 8601 date (YYYY-MM-DD) if determinable, else null' },
    lpo_number: { type: ['string', 'null'], description: 'Customer LPO / PO number if printed' },
    total_discount: money('Invoice discount total if printed'),
    total_before_vat: money('Total amount before VAT if printed'),
    total_vat: money('Total VAT amount if printed'),
    grand_total: money('Grand total including VAT if printed'),
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          sku: { type: ['string', 'null'], description: 'Supplier item code / SKU if printed, else null' },
          uom: { type: ['string', 'null'], description: 'Unit of measure / packing, e.g. CAR, BAG, EA, BDL' },
          pack_size: { type: ['number', 'null'], description: 'Pack size in base units if printed (e.g. 2 for a 2kg pack), else null' },
          quantity: { type: 'number' },
          unit_price: { type: 'number', description: 'Rate per unit before discount and VAT' },
          discount: money('Discount for the whole line (amount), 0 if the column shows 0'),
          amount_before_vat: money('Line amount before VAT'),
          vat_percent: money('VAT percentage for the line, e.g. 5 or 0'),
          vat_amount: money('VAT amount for the line'),
          amount_including_vat: money('Line amount including VAT'),
          confidence: { type: 'number', description: '0-100 confidence this line was read correctly' },
          is_uncertain: { type: 'boolean' },
        },
        required: [
          'description', 'sku', 'uom', 'pack_size', 'quantity', 'unit_price', 'discount', 'amount_before_vat',
          'vat_percent', 'vat_amount', 'amount_including_vat', 'confidence', 'is_uncertain',
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    'supplier_name', 'supplier_trn', 'invoice_number', 'invoice_date', 'lpo_number',
    'total_discount', 'total_before_vat', 'total_vat', 'grand_total', 'items',
  ],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You extract structured line-item data from restaurant supplier invoices/bills (UAE tax invoices). These are a photo or scanned PDF of a printed or handwritten supplier invoice; columns are typically Sr.No, Item Code, Item Description, UOM, QTY, Rate, Discount, Amount before VAT, VAT %, VAT Amount, Amount including VAT.

For each line item, in the order printed, extract: description (verbatim item name/spec), sku (the item code column, else null), uom (CAR/CTN/BAG/EA/BDL/KG… — null if absent), pack_size (numeric pack size if printed, e.g. 2 for "2kg" — null if absent), quantity (numeric, may be fractional like 0.5), unit_price (the Rate per unit — if only a line total is given, divide by quantity), discount (the line's discount amount), amount_before_vat, vat_percent (e.g. 5), vat_amount and amount_including_vat. Use null for a column that isn't on the invoice. Include zero-value lines such as a delivery charge.

Set confidence 0-100 for how sure you are the line was read correctly, and is_uncertain=true when confidence is below 70 (blurry text, ambiguous numbers, merged columns, etc), or when quantity × rate − discount doesn't match the printed amount before VAT. Never invent a number you cannot actually read — mark it uncertain instead of guessing.

From the header and footer extract supplier_name, supplier_trn (the seller's TRN — invoices also print the customer's TRN; don't confuse them), invoice_number, invoice_date, lpo_number, and the printed totals (total_discount, total_before_vat, total_vat, grand_total), else null.`

export async function extractFromImageOrPdf(base64Data: string, mimeType: string, _fileName: string) {
  return callGemini<ExtractedInvoice>({ instructions: INSTRUCTIONS, schema: EXTRACTION_SCHEMA, parts: fileParts(base64Data, mimeType) })
}
