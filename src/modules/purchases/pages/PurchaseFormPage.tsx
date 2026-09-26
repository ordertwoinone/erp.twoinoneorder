import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import {
  AlertCircle,
  Building2,
  CalendarDays,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Send,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useCategoriesOptions, useProductsOptions, useSuppliersOptions, useUnitsOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { computeLines, purchaseFormSchema, type PurchaseFormInput, type PurchaseItemInput } from '@/schemas/purchase'
import { usePurchaseQuery } from '../hooks/usePurchases'
import { useSavePurchaseDraft, useSubmitPurchaseForApproval } from '../hooks/usePurchaseMutations'
import { fetchAgreedPrices, type ItemSearchResult } from '../hooks/useItemSearch'
import type { TemplateLine, TemplateSource } from '../hooks/usePurchaseTemplates'
import { ItemSearchCombobox, packText } from '../components/ItemSearchCombobox'
import { AddNewItemDialog } from '../components/AddNewItemDialog'
import { InvoiceScanDialog, type ScannedInvoiceResult } from '../components/InvoiceScanDialog'
import { PurchaseLineItemRow } from '../components/PurchaseLineItemRow'
import { InvoiceSummaryCard, NotesCard, SupplierQuoteComparison } from '../components/InvoiceSummarySidebar'
import { ImportTemplateDialog } from '../components/ImportTemplateDialog'

const PAYMENT_TERMS = [0, 7, 15, 30, 45, 60, 90]
const DEFAULT_VAT = 0.05
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

interface RawLine {
  product_id: string
  unit_id: string
  quantity: number
  unit_price: number
  pack_size?: number | null
}

export default function PurchaseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = usePurchaseQuery(id)
  const { data: restaurants = [] } = useRestaurantsQuery()
  const { data: suppliers = [] } = useSuppliersOptions()
  const { data: categories = [] } = useCategoriesOptions()
  const { data: units = [] } = useUnitsOptions()
  const { data: products = [] } = useProductsOptions()
  const saveDraft = useSavePurchaseDraft()
  const submitForApproval = useSubmitPurchaseForApproval()

  const [addNewItemOpen, setAddNewItemOpen] = useState(false)
  const [addNewItemName, setAddNewItemName] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [scanResultId, setScanResultId] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [highlightComparison, setHighlightComparison] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const comparisonRef = useRef<HTMLElement>(null)

  const form = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      supplier_id: '',
      invoice_number: '',
      invoice_date: new Date().toISOString().slice(0, 10),
      payment_terms_days: '',
      invoice_discount: 0,
      notes: '',
      items: [],
    },
  })
  const { control, handleSubmit, reset, watch, setValue, getValues, setFocus, formState, register } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const items = watch('items')
  const invoiceDiscount = watch('invoice_discount')
  const restaurantId = watch('restaurant_id') || null
  const supplierId = watch('supplier_id') || null
  const paymentTerms = watch('payment_terms_days')
  const lines = useMemo(() => computeLines(items, Number(invoiceDiscount) || 0), [items, invoiceDiscount])
  const itemsAboveContract = items.filter((i) => i.agreed_price != null && i.agreed_price > 0 && (Number(i.unit_price) || 0) > i.agreed_price * 1.005)

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])

  useEffect(() => {
    if (!existing) return
    const { purchase } = existing
    reset({
      id: purchase.id,
      restaurant_id: purchase.restaurant_id,
      supplier_id: purchase.supplier_id,
      invoice_number: purchase.invoice_number,
      invoice_date: purchase.invoice_date,
      payment_terms_days: purchase.payment_terms_days ?? '',
      invoice_discount: existing.items.reduce((s: number, i: any) => s + (Number(i.discount_amount) || 0), 0),
      notes: purchase.notes ?? '',
      items: existing.items.map((item: any) => {
        const net = item.quantity * item.unit_price - item.discount_amount
        return {
          product_id: item.product_id,
          unit_id: item.unit_id,
          pack_size: item.pack_size ?? '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: net > 0 && item.tax_amount / net > 0.025 ? 0.05 : 0,
          product_name: item.products?.name,
          brand_name: item.products?.brands?.name ?? undefined,
          pack_label: item.pack_size ? `Pack (${item.pack_size} ${item.units?.code ?? ''})` : undefined,
          size_label: item.pack_size ? `${item.pack_size} ${item.units?.code ?? ''}` : undefined,
          unit_code: item.units?.code,
          agreed_price: item.agreed_price_at_entry,
          agreed_unit_id: item.unit_id,
          last_purchase_price: null,
        }
      }),
    })
  }, [existing, reset])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (isEditing && isLoadingExisting) return <FullScreenSpinner />

  /** Builds full form lines (names, brand, pack, contract price) for raw product/unit/qty/price lines. */
  async function buildLines(raw: RawLine[]): Promise<PurchaseItemInput[]> {
    const sid = getValues('supplier_id')
    const agreed = sid ? await fetchAgreedPrices(sid, [...new Set(raw.map((r) => r.product_id))]).catch(() => new Map<string, number>()) : new Map<string, number>()
    return raw.map((r) => {
      const product = productsById.get(r.product_id)
      const unit = unitsById.get(r.unit_id)
      const pack = r.pack_size ?? product?.pack_size ?? null
      return {
        product_id: r.product_id,
        unit_id: r.unit_id,
        pack_size: pack ?? '',
        quantity: r.quantity,
        unit_price: r.unit_price,
        vat_rate: DEFAULT_VAT,
        product_name: product?.name ?? 'Item',
        brand_name: product?.brands?.name ?? undefined,
        category_name: product?.categories?.name ?? undefined,
        pack_label: pack ? `Pack (${pack} ${unit?.code ?? ''})` : undefined,
        size_label: pack ? `${pack} ${unit?.code ?? ''}` : undefined,
        unit_code: unit?.code,
        agreed_price: agreed.get(`${r.product_id}|${r.unit_id}`) ?? null,
        agreed_unit_id: r.unit_id,
        last_purchase_price: null,
      }
    })
  }

  /** Appends lines, adding to the quantity of an existing line for the same product + unit instead of duplicating it. */
  function mergeLines(newLines: PurchaseItemInput[]) {
    let focusIndex: number | null = null
    let appended = 0
    for (const line of newLines) {
      const current = getValues('items')
      const existingIndex = current.findIndex((it) => it.product_id === line.product_id && it.unit_id === line.unit_id)
      if (existingIndex >= 0) {
        setValue(`items.${existingIndex}.quantity`, (Number(current[existingIndex].quantity) || 0) + (Number(line.quantity) || 0), { shouldDirty: true })
        focusIndex = existingIndex
      } else {
        append(line)
        focusIndex = current.length
        appended++
      }
    }
    if (focusIndex !== null) {
      const index = focusIndex
      requestAnimationFrame(() => setFocus(`items.${index}.quantity`))
    }
    return appended
  }

  function handleSelectSearchResult(item: ItemSearchResult) {
    const current = getValues('items')
    const existingIndex = current.findIndex((it) => it.product_id === item.product_id && it.unit_id === item.base_unit_id)
    if (existingIndex >= 0) toast.info(`${item.name} is already on this invoice — quantity increased by 1.`)
    mergeLines([
      {
        product_id: item.product_id,
        unit_id: item.base_unit_id,
        pack_size: item.pack_size ?? '',
        quantity: 1,
        unit_price: item.agreed_price ?? item.last_purchase_price ?? 0,
        vat_rate: DEFAULT_VAT,
        product_name: item.name,
        brand_name: item.brand_name ?? undefined,
        category_name: item.category_name ?? undefined,
        pack_label: packText(item),
        size_label: item.pack_size ? `${item.pack_size} ${item.pack_unit_code ?? item.base_unit_code}` : item.base_unit_code,
        unit_code: item.base_unit_code,
        agreed_price: item.agreed_price,
        agreed_unit_id: item.base_unit_id,
        last_purchase_price: item.last_purchase_price,
      },
    ])
  }

  async function handlePickProduct(index: number, productId: string) {
    const product = productsById.get(productId)
    if (!product) return
    const duplicate = getValues('items').findIndex((it, i) => i !== index && it.product_id === productId && it.unit_id === product.base_unit_id)
    if (duplicate >= 0) {
      remove(index)
      setValue(`items.${duplicate}.quantity`, (Number(getValues(`items.${duplicate}.quantity`)) || 0) + 1, { shouldDirty: true })
      toast.info(`${product.name} is already on this invoice — quantity increased by 1.`)
      return
    }
    const [line] = await buildLines([{ product_id: productId, unit_id: product.base_unit_id, quantity: Number(getValues(`items.${index}.quantity`)) || 1, unit_price: 0 }])
    line.unit_price = line.agreed_price ?? 0
    form.setValue(`items.${index}`, line, { shouldDirty: true })
  }

  async function handleUnitChange(index: number, unitId: string) {
    const line = getValues(`items.${index}`)
    const unit = unitsById.get(unitId)
    setValue(`items.${index}.unit_id`, unitId, { shouldDirty: true })
    setValue(`items.${index}.unit_code`, unit?.code)
    const sid = getValues('supplier_id')
    if (!line.product_id || !sid) return
    const agreed = await fetchAgreedPrices(sid, [line.product_id]).catch(() => new Map<string, number>())
    setValue(`items.${index}.agreed_price`, agreed.get(`${line.product_id}|${unitId}`) ?? null)
  }

  async function handleSupplierChange(newSupplierId: string) {
    setValue('supplier_id', newSupplierId, { shouldValidate: !!formState.submitCount })
    const supplier = suppliers.find((s) => s.id === newSupplierId)
    setValue('payment_terms_days', supplier ? supplier.payment_terms_days : '')
    const current = getValues('items').filter((i) => i.product_id)
    if (!newSupplierId || current.length === 0) return
    const agreed = await fetchAgreedPrices(newSupplierId, [...new Set(current.map((i) => i.product_id))]).catch(() => new Map<string, number>())
    getValues('items').forEach((it, i) => setValue(`items.${i}.agreed_price`, agreed.get(`${it.product_id}|${it.unit_id}`) ?? null))
  }

  function handleItemCreated(product: { id: string; name: string; baseUnitId: string; baseUnitCode: string; brandName: string | null }) {
    mergeLines([
      {
        product_id: product.id,
        unit_id: product.baseUnitId,
        pack_size: '',
        quantity: 1,
        unit_price: 0,
        vat_rate: DEFAULT_VAT,
        product_name: product.name,
        brand_name: product.brandName ?? undefined,
        unit_code: product.baseUnitCode,
        size_label: product.baseUnitCode,
        agreed_price: null,
        agreed_unit_id: product.baseUnitId,
        last_purchase_price: null,
      },
    ])
  }

  async function handleScanConfirm(result: ScannedInvoiceResult) {
    if (!getValues('invoice_number')) setValue('invoice_number', result.invoiceNumber)
    if (result.invoiceDate) setValue('invoice_date', result.invoiceDate)
    const built = await buildLines(
      result.items.map((i) => ({
        product_id: i.productId,
        unit_id: i.unitId,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        pack_size: i.packSize ? Number(i.packSize) : null,
      })),
    )
    mergeLines(built)
    setScanResultId(result.scanResultId)
  }

  async function handleImportTemplate(templateLines: TemplateLine[], source: TemplateSource) {
    const built = await buildLines(templateLines)
    const added = mergeLines(built)
    toast.success(`Imported ${templateLines.length} item${templateLines.length === 1 ? '' : 's'} from ${source.label}`, {
      description: added < templateLines.length ? 'Items already on the invoice had their quantity increased.' : undefined,
    })
  }

  function viewPriceAlerts() {
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightComparison(true)
    setTimeout(() => setHighlightComparison(false), 2000)
  }

  async function uploadPendingAttachment(purchaseId: string) {
    if (!attachmentFile) return
    const values = getValues()
    const path = `${values.restaurant_id}/purchase/${purchaseId}/${crypto.randomUUID()}-${attachmentFile.name}`
    const { error: uploadError } = await supabase.storage.from('invoices').upload(path, attachmentFile, { contentType: attachmentFile.type })
    if (uploadError) {
      toast.error('Invoice saved, but the attached file failed to upload', { description: uploadError.message })
      return
    }
    await supabase.from('attachments').insert({
      restaurant_id: values.restaurant_id,
      entity_type: 'purchase',
      entity_id: purchaseId,
      category: 'invoices',
      storage_bucket: 'invoices',
      storage_path: path,
      file_name: attachmentFile.name,
      mime_type: attachmentFile.type,
      file_size_bytes: attachmentFile.size,
    })
    setAttachmentFile(null)
  }

  async function onSaveDraft(values: PurchaseFormInput) {
    const purchaseId = await saveDraft.mutateAsync({ values, scanResultId })
    await uploadPendingAttachment(purchaseId)
  }

  async function onSubmitForApproval(values: PurchaseFormInput) {
    const purchaseId = await submitForApproval.mutateAsync({ values, scanResultId })
    await uploadPendingAttachment(purchaseId)
  }

  function onInvalid() {
    toast.error('Some fields need attention', { description: 'Check the highlighted fields and line items.' })
  }

  const isBusy = saveDraft.isPending || submitForApproval.isPending
  const termOptions = paymentTerms !== '' && paymentTerms !== undefined && !PAYMENT_TERMS.includes(Number(paymentTerms))
    ? [...PAYMENT_TERMS, Number(paymentTerms)].sort((a, b) => a - b)
    : PAYMENT_TERMS
  const chipCategories = categories.slice(0, 4)
  const errors = formState.errors

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Purchase' : 'New Purchase'}
            <span className="inline-flex items-center gap-1 rounded-md bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground">
              <FileText className="size-3.5" /> Draft
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">Create a purchase invoice and submit it for approval.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InvoiceScanDialog restaurantId={restaurantId} supplierId={supplierId} onConfirm={handleScanConfirm} />
          <Button type="button" variant="outline" size="lg" onClick={handleSubmit(onSaveDraft, onInvalid)} disabled={isBusy}>
            {saveDraft.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save draft
          </Button>
          <Button type="button" size="lg" onClick={handleSubmit(onSubmitForApproval, onInvalid)} disabled={isBusy}>
            {submitForApproval.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Submit for approval
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {/* Invoice details */}
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Invoice details</h2>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.4fr_1fr_1fr_0.8fr_auto]">
              <div className="space-y-1.5">
                <Label>
                  Restaurant <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="restaurant_id"
                  render={({ field }) => (
                    <div className="relative">
                      <UtensilsCrossed className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Select value={field.value || undefined} onValueChange={field.onChange} disabled={isEditing}>
                        <SelectTrigger className="h-10 w-full pl-9" aria-invalid={!!errors.restaurant_id}>
                          <SelectValue placeholder="Select restaurant" />
                        </SelectTrigger>
                        <SelectContent>
                          {restaurants.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
                {errors.restaurant_id && <p className="text-xs text-destructive">{errors.restaurant_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Select value={supplierId ?? undefined} onValueChange={handleSupplierChange}>
                    <SelectTrigger className={cn('h-10 w-full pl-9', supplierId && 'pr-14')} aria-invalid={!!errors.supplier_id}>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {supplierId && (
                    <button
                      type="button"
                      onClick={() => handleSupplierChange('')}
                      className="absolute top-1/2 right-8 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear supplier"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {errors.supplier_id && <p className="text-xs text-destructive">{errors.supplier_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoice_number">
                  Invoice no. <span className="text-destructive">*</span>
                </Label>
                <Input id="invoice_number" className="h-10" placeholder="e.g. ASF-2024-1187" aria-invalid={!!errors.invoice_number} {...register('invoice_number')} />
                {errors.invoice_number && <p className="text-xs text-destructive">{errors.invoice_number.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoice_date">
                  Invoice date <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="invoice_date" type="date" className="h-10 pl-9" aria-invalid={!!errors.invoice_date} {...register('invoice_date')} />
                </div>
                {errors.invoice_date && <p className="text-xs text-destructive">{errors.invoice_date.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Payment terms</Label>
                <Controller
                  control={control}
                  name="payment_terms_days"
                  render={({ field }) => (
                    <Select value={field.value === '' || field.value === undefined ? undefined : String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Terms" />
                      </SelectTrigger>
                      <SelectContent>
                        {termOptions.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d === 0 ? 'On receipt' : `${d} days`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Attach invoice</Label>
                <label
                  className={cn(
                    'flex h-16 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/50 px-2 text-center text-xs font-medium text-primary hover:bg-primary/5',
                    attachmentFile && 'border-solid bg-primary/5',
                  )}
                  title={attachmentFile?.name}
                >
                  {attachmentFile ? <Paperclip className="size-4" /> : <FileUp className="size-4" />}
                  <span className="w-full truncate">{attachmentFile?.name ?? 'Upload file'}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return void toast.error('Only PDF, JPG or PNG files can be attached.')
                      if (file.size > MAX_ATTACHMENT_BYTES) return void toast.error('The file is larger than 10 MB.')
                      setAttachmentFile(file)
                    }}
                  />
                </label>
                <p className="w-28 text-center text-[10px] leading-tight text-muted-foreground">PDF, JPG or PNG (Max 10 MB)</p>
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Items</h2>
            <div className="flex flex-wrap items-center gap-2">
              <ItemSearchCombobox
                ref={searchInputRef}
                supplierId={supplierId}
                restaurantId={restaurantId}
                categoryId={categoryId}
                onSelect={handleSelectSearchResult}
                onAddNew={(name) => {
                  setAddNewItemName(name)
                  setAddNewItemOpen(true)
                }}
              />
              <Select value={categoryId ?? 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? null : v)}>
                <SelectTrigger className="h-10 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chipCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId((prev) => (prev === c.id ? null : c.id))}
                  className={cn(
                    'h-10 rounded-lg border px-3 text-sm transition-colors',
                    categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted',
                  )}
                >
                  {c.name}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-10 border-primary text-primary"
                onClick={() => {
                  setAddNewItemName('')
                  setAddNewItemOpen(true)
                }}
              >
                <Plus /> Add new item
              </Button>
            </div>

            {itemsAboveContract.length > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/15 px-4 py-2.5 text-sm font-medium text-warning-foreground lg:ml-auto lg:w-fit lg:min-w-md">
                <AlertCircle className="size-5 shrink-0 fill-warning text-background" />
                <span className="flex-1">
                  Price alerts: {itemsAboveContract.length} item{itemsAboveContract.length === 1 ? '' : 's'} above agreed price
                </span>
                <button type="button" onClick={viewPriceAlerts} className="underline underline-offset-2 hover:no-underline">
                  View details
                </button>
              </div>
            )}

            {errors.items?.message && <p className="mt-3 text-sm text-destructive">{errors.items.message}</p>}

            <div className="mt-4 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Brand &amp; pack</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="leading-tight">Contract price<br />(AED)</TableHead>
                    <TableHead className="leading-tight">Invoice price<br />(AED)</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>VAT</TableHead>
                    <TableHead className="text-right leading-tight">Line total<br />(AED)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.length === 0 ? (
                    <TableRow>
                      <TableHead colSpan={11} className="h-20 text-center font-normal text-muted-foreground">
                        {supplierId && restaurantId
                          ? 'Search above to add items, add one manually, or import from a template.'
                          : 'Select the restaurant and supplier, then add items.'}
                      </TableHead>
                    </TableRow>
                  ) : (
                    fields.map((field, index) => (
                      <PurchaseLineItemRow
                        key={field.id}
                        index={index}
                        form={form}
                        line={lines[index] ?? { gross: 0, discount: 0, vat: 0, total: 0 }}
                        units={units}
                        products={products}
                        onPickProduct={handlePickProduct}
                        onUnitChange={handleUnitChange}
                        onRemove={() => remove(index)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-primary/40 bg-primary/5 text-primary"
                onClick={() => {
                  append({ product_id: '', unit_id: '', pack_size: '', quantity: 1, unit_price: 0, vat_rate: DEFAULT_VAT, agreed_price: null, last_purchase_price: null })
                }}
              >
                <Plus /> Add item manually
              </Button>
              <Button type="button" variant="outline" onClick={() => setTemplateOpen(true)}>
                <FileText /> Import from template
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <InvoiceSummaryCard form={form} lines={lines} />
          <SupplierQuoteComparison ref={comparisonRef} form={form} highlighted={highlightComparison} />
          <NotesCard form={form} />
        </aside>
      </div>

      <AddNewItemDialog open={addNewItemOpen} onOpenChange={setAddNewItemOpen} initialName={addNewItemName} onCreated={handleItemCreated} />
      <ImportTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        supplierId={supplierId}
        restaurantId={restaurantId}
        onImport={handleImportTemplate}
      />
    </div>
  )
}
