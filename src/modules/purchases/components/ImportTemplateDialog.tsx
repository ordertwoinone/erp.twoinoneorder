import { useState } from 'react'
import { FileText, Loader2, PackageSearch, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils/format'
import { fetchTemplateLines, usePurchaseTemplatesQuery, type TemplateLine, type TemplateSource } from '../hooks/usePurchaseTemplates'

export function ImportTemplateDialog({
  open,
  onOpenChange,
  supplierId,
  restaurantId,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string | null
  restaurantId: string | null
  onImport: (lines: TemplateLine[], source: TemplateSource) => Promise<void> | void
}) {
  const { data: sources, isLoading } = usePurchaseTemplatesQuery(supplierId, restaurantId, open)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function pick(source: TemplateSource) {
    setLoadingId(source.id)
    try {
      const lines = await fetchTemplateLines(source)
      if (lines.length === 0) {
        toast.info(`${source.label} has no items to import.`)
        return
      }
      await onImport(lines, source)
      onOpenChange(false)
    } catch (error) {
      toast.error('Unable to import items', { description: (error as Error).message })
    } finally {
      setLoadingId(null)
    }
  }

  const orders = sources?.filter((s) => s.kind === 'order') ?? []
  const purchases = sources?.filter((s) => s.kind === 'purchase') ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from template</DialogTitle>
          <DialogDescription>
            Copy the items from a purchase order or a previous invoice from this supplier. Quantities and prices can be edited after import.
          </DialogDescription>
        </DialogHeader>

        {!supplierId || !restaurantId ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Select the restaurant and supplier first.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !sources?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No purchase orders or previous invoices with this supplier for this restaurant yet.</p>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {[
              { title: 'Purchase orders', icon: ShoppingCart, list: orders },
              { title: 'Previous invoices', icon: FileText, list: purchases },
            ].map(
              (group) =>
                group.list.length > 0 && (
                  <div key={group.title}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <group.icon className="size-3.5" /> {group.title}
                    </p>
                    <div className="space-y-1.5">
                      {group.list.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          disabled={!!loadingId}
                          onClick={() => pick(source)}
                          className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-60"
                        >
                          {loadingId === source.id ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          ) : (
                            <PackageSearch className="size-4 text-primary" />
                          )}
                          <span className="flex-1 font-medium">{source.label}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(source.date)}</span>
                          <StatusBadge status={source.status} />
                        </button>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
