import { forwardRef, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Command as CommandPrimitive } from 'cmdk'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ItemThumb } from '@/modules/purchases/components/ItemThumb'
import { useStockItemSearch, type StockItem } from '../hooks/useStockDocuments'

/** Find an item by name, code or barcode (Enter on an exact barcode adds it). */
export const StockItemSearch = forwardRef<
  HTMLInputElement,
  { restaurantId: string | null; supplierId?: string | null; disabledText: string; onSelect: (item: StockItem) => void }
>(function StockItemSearch({ restaurantId, supplierId = null, disabledText, onSelect }, ref) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const debounced = useDebouncedValue(query, 200)
  const disabled = !restaurantId
  const { data: results = [], isFetching } = useStockItemSearch(restaurantId, debounced, supplierId)

  useEffect(() => {
    function close() {
      setIsOpen(false)
    }
    if (isOpen) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [isOpen])

  function pick(item: StockItem) {
    onSelect(item)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="relative min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={ref}
            value={query}
            onValueChange={(v) => {
              setQuery(v)
              setIsOpen(true)
            }}
            onFocus={() => query && setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsOpen(false)
            }}
            disabled={disabled}
            placeholder={disabled ? disabledText : 'Item name, code or scan barcode…'}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        {isOpen && !disabled && (
          <div className="absolute top-full z-30 mt-1 w-full min-w-80 overflow-hidden rounded-lg border bg-popover shadow-lg sm:min-w-xl">
            <CommandList className="max-h-80">
              <CommandEmpty className="p-3 text-sm text-muted-foreground">{isFetching ? 'Searching…' : 'No matching items.'}</CommandEmpty>
              <CommandGroup className="p-0">
                {results.map((item) => (
                  <CommandItem
                    key={item.product_id}
                    value={item.product_id}
                    onSelect={() => pick(item)}
                    className="flex items-center gap-3 rounded-none border-b px-3 py-2 last:border-b-0"
                  >
                    <ItemThumb name={item.name} imagePath={item.image_path} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.sku, item.barcode, item.base_unit_code].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums">
                      <p>
                        Stock <span className={item.current_stock > 0 ? 'font-semibold' : 'font-semibold text-destructive'}>{Number(item.current_stock).toFixed(2)}</span>
                      </p>
                      <p className="text-muted-foreground">Cost {Number(item.average_cost || item.last_cost).toFixed(2)}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  )
})
