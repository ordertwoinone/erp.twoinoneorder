import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Loader2, Paperclip, Plus, Send, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { FullScreenSpinner } from '@/components/shared/FullScreenSpinner'
import { supabase } from '@/lib/supabase/client'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useSuppliersOptions } from '@/hooks/useCatalogOptions'
import { useRestaurantScope } from '@/hooks/useRestaurantScope'
import { purchaseFormSchema, type PurchaseFormInput } from '@/schemas/purchase'
import { usePurchaseQuery } from '../hooks/usePurchases'
import { useSavePurchaseDraft, useSubmitPurchaseForApproval } from '../hooks/usePurchaseMutations'
import { ItemSearchCombobox } from '../components/ItemSearchCombobox'
import { AddNewItemDialog } from '../components/AddNewItemDialog'
import { InvoiceScanDialog, type ScannedInvoiceResult } from '../components/InvoiceScanDialog'
import { PurchaseLineItemRow } from '../components/PurchaseLineItemRow'
import { InvoiceSummarySidebar } from '../components/InvoiceSummarySidebar'
import type { ItemSearchResult } from '../hooks/useItemSearch'

const emptyItems: PurchaseFormInput['items'] = []

export default function PurchaseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { selectedRestaurantId } = useRestaurantScope()

  const { data: existing, isLoading: isLoadingExisting } = usePurchaseQuery(id)
  const { data: restaurants } = useRestaurantsQuery()
  const { data: suppliers } = useSuppliersOptions()
  const saveDraft = useSavePurchaseDraft()
  const submitForApproval = useSubmitPurchaseForApproval()

  const [addNewItemOpen, setAddNewItemOpen] = useState(false)
  const [addNewItemName, setAddNewItemName] = useState('')
  const [scanResultId, setScanResultId] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      restaurant_id: selectedRestaurantId ?? '',
      supplier_id: '',
      invoice_number: '',
      invoice_date: new Date().toISOString().slice(0, 10),
      notes: '',
      items: emptyItems,
    },
  })
  const { control, handleSubmit, reset, watch, setValue, getValues, setFocus, formState } = form

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const restaurantId = watch('restaurant_id') || null
  const supplierId = watch('supplier_id') || null
  const supplier = suppliers?.find((s) => s.id === supplierId)

  useEffect(() => {
    if (!existing) return
    reset({
      id: existing.purchase.id,
      restaurant_id: existing.purchase.restaurant_id,
      supplier_id: existing.purchase.supplier_id,
      invoice_number: existing.purchase.invoice_number,
      invoice_date: existing.purchase.invoice_date,
      notes: existing.purchase.notes ?? '',
      items: existing.items.map((item: any) => ({
        product_id: item.product_id,
        unit_id: item.unit_id,
        pack_size: item.pack_size ?? '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_amount: item.tax_amount,
        product_name: item.products?.name,
        brand_name: item.products?.brands?.name ?? undefined,
        unit_code: item.units?.code,
        agreed_price: item.agreed_price_at_entry,
        last_purchase_price: null,
      })),
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

  function addOrIncrementItem(entry: {
    productId: string
    unitId: string
    productName: string
    brandName: string | null
    packLabel?: string
    unitCode: string
    packSize: number | null
    unitPrice: number
    agreedPrice: number | null
    lastPurchasePrice: number | null
  }) {
    const currentItems = getValues('items')
    const existingIndex = currentItems.findIndex((it) => it.product_id === entry.productId && it.unit_id === entry.unitId)

    if (existingIndex >= 0) {
      setValue(`items.${existingIndex}.quantity`, (Number(currentItems[existingIndex].quantity) || 0) + 1, {
        shouldDirty: true,
      })
      setFocus(`items.${existingIndex}.quantity`)
      return
    }

    append({
      product_id: entry.productId,
      unit_id: entry.unitId,
      pack_size: entry.packSize ?? '',
      quantity: 1,
      unit_price: entry.unitPrice,
      discount_amount: 0,
      tax_amount: 0,
      product_name: entry.productName,
      brand_name: entry.brandName ?? undefined,
      pack_label: entry.packLabel,
      unit_code: entry.unitCode,
      agreed_price: entry.agreedPrice,
      last_purchase_price: entry.lastPurchasePrice,
    })
    setFocus(`items.${fields.length}.quantity`)
  }

  function handleSelectSearchResult(item: ItemSearchResult) {
    addOrIncrementItem({
      productId: item.product_id,
      unitId: item.base_unit_id,
      productName: item.name,
      brandName: item.brand_name,
      packLabel: item.pack_size ? `Pack (${item.pack_size} ${item.pack_unit_code ?? item.base_unit_code})` : undefined,
      unitCode: item.base_unit_code,
      packSize: item.pack_size,
      unitPrice: item.agreed_price ?? item.last_purchase_price ?? 0,
      agreedPrice: item.agreed_price,
      lastPurchasePrice: item.last_purchase_price,
    })
  }

  function handleItemCreated(product: { id: string; name: string; baseUnitId: string; baseUnitCode: string; brandName: string | null }) {
    addOrIncrementItem({
      productId: product.id,
      unitId: product.baseUnitId,
      productName: product.name,
      brandName: product.brandName,
      unitCode: product.baseUnitCode,
      packSize: null,
      unitPrice: 0,
      agreedPrice: null,
      lastPurchasePrice: null,
    })
  }

  function handleScanConfirm(result: ScannedInvoiceResult) {
    if (!getValues('invoice_number')) setValue('invoice_number', result.invoiceNumber)
    if (result.invoiceDate) setValue('invoice_date', result.invoiceDate)
    for (const item of result.items) {
      append({
        product_id: item.productId,
        unit_id: item.unitId,
        pack_size: item.packSize ? Number(item.packSize) : '',
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: 0,
        tax_amount: item.taxAmount,
        agreed_price: null,
        last_purchase_price: null,
      })
    }
    setScanResultId(result.scanResultId)
  }

  async function uploadPendingAttachment(purchaseId: string) {
    if (!attachmentFile) return
    const values = getValues()
    const path = `${values.restaurant_id}/purchase/${purchaseId}/${crypto.randomUUID()}-${attachmentFile.name}`
    const { error: uploadError } = await supabase.storage.from('invoices').upload(path, attachmentFile, {
      contentType: attachmentFile.type,
    })
    if (uploadError) return
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

  const isBusy = saveDraft.isPending || submitForApproval.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {isEditing ? 'Edit Purchase' : 'New Purchase'}
            <Badge variant="secondary">Draft</Badge>
          </span>
        }
        description="Create a purchase invoice and submit it for approval."
        actions={
          <div className="flex gap-2">
            <InvoiceScanDialog restaurantId={restaurantId} supplierId={supplierId} onConfirm={handleScanConfirm} />
            <Button type="button" variant="outline" onClick={handleSubmit(onSaveDraft)} disabled={isBusy}>
              {saveDraft.isPending && <Loader2 className="animate-spin" />}
              Save draft
            </Button>
            <Button type="button" onClick={handleSubmit(onSubmitForApproval)} disabled={isBusy}>
              {submitForApproval.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Submit for approval
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Restaurant *</Label>
                <Controller
                  control={control}
                  name="restaurant_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select restaurant" />
                      </SelectTrigger>
                      <SelectContent>
                        {restaurants?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formState.errors.restaurant_id && (
                  <p className="text-sm text-destructive">{formState.errors.restaurant_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Controller
                  control={control}
                  name="supplier_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formState.errors.supplier_id && (
                  <p className="text-sm text-destructive">{formState.errors.supplier_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment terms</Label>
                <div className="flex h-9 items-center text-sm text-muted-foreground">
                  {supplier ? `${supplier.payment_terms_days} days` : '—'}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice no. *</Label>
                <Input id="invoice_number" {...form.register('invoice_number')} />
                {formState.errors.invoice_number && (
                  <p className="text-sm text-destructive">{formState.errors.invoice_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice date *</Label>
                <Input id="invoice_date" type="date" {...form.register('invoice_date')} />
                {formState.errors.invoice_date && (
                  <p className="text-sm text-destructive">{formState.errors.invoice_date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Attach invoice</Label>
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted/50">
                  {attachmentFile ? <Paperclip className="size-4" /> : <Upload className="size-4" />}
                  <span className="truncate">{attachmentFile?.name ?? 'Upload file (PDF, JPG or PNG, max 10MB)'}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && file.size <= 10 * 1024 * 1024) setAttachmentFile(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ItemSearchCombobox
                ref={searchInputRef}
                supplierId={supplierId}
                restaurantId={restaurantId}
                onSelect={handleSelectSearchResult}
                onAddNew={(name) => {
                  setAddNewItemName(name)
                  setAddNewItemOpen(true)
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddNewItemName('')
                    setAddNewItemOpen(true)
                  }}
                >
                  <Plus /> Add new item
                </Button>
              </div>

              {formState.errors.items?.message && <p className="text-sm text-destructive">{formState.errors.items.message}</p>}

              {fields.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Contract price</TableHead>
                        <TableHead>Invoice price</TableHead>
                        <TableHead>Variance</TableHead>
                        <TableHead>VAT</TableHead>
                        <TableHead className="text-right">Line total</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <PurchaseLineItemRow
                          key={field.id}
                          index={index}
                          control={control}
                          watch={watch}
                          onRemove={() => remove(index)}
                          canRemove={fields.length > 0}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-1">
          <InvoiceSummarySidebar
            items={items}
            notes={watch('notes') ?? ''}
            onNotesChange={(value) => setValue('notes', value)}
          />
        </div>
      </div>

      <div className="flex justify-start">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>

      <AddNewItemDialog
        open={addNewItemOpen}
        onOpenChange={setAddNewItemOpen}
        initialName={addNewItemName}
        onCreated={handleItemCreated}
      />
    </div>
  )
}
