import { forwardRef, useEffect, useMemo, useState } from 'react'
import { Loader2, Package, Plus } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useItemSearchQuery, type ItemSearchResult } from '../hooks/useItemSearch'

interface ItemSearchComboboxProps {
  supplierId: string | null
  restaurantId: string | null
  onSelect: (item: ItemSearchResult) => void
  onAddNew: (name: string) => void
}

export const ItemSearchCombobox = forwardRef<HTMLInputElement, ItemSearchComboboxProps>(function ItemSearchCombobox(
  { supplierId, restaurantId, onSelect, onAddNew },
  ref,
) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const debouncedQuery = useDebouncedValue(query, 250)
  const disabled = !supplierId || !restaurantId

  const { data: allResults = [], isFetching } = useItemSearchQuery(supplierId, restaurantId, debouncedQuery)
  const categories = useMemo(
    () => Array.from(new Set(allResults.map((r) => r.category_name).filter((c): c is string => !!c))),
    [allResults],
  )
  const results = categoryFilter ? allResults.filter((r) => r.category_name === categoryFilter) : allResults

  useEffect(() => {
    function handleClickOutside() {
      setIsOpen(false)
    }
    if (isOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="flex items-center gap-2 rounded-md border px-3">
          <CommandInput
            ref={ref}
            value={query}
            onValueChange={(v) => {
              setQuery(v)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={
              disabled ? 'Select a supplier and restaurant first…' : 'Search by item name, SKU, brand or barcode…'
            }
            disabled={disabled}
            className="border-0 px-0 focus-visible:ring-0"
          />
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Press ⌘K to focus
          </kbd>
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b p-2">
                <Badge
                  variant={categoryFilter === null ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter(null)}
                >
                  All categories
                </Badge>
                {categories.map((c) => (
                  <Badge
                    key={c}
                    variant={categoryFilter === c ? 'default' : 'outline'}
                    className={cn('cursor-pointer', categoryFilter === c && 'bg-primary')}
                    onClick={() => setCategoryFilter((prev) => (prev === c ? null : c))}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            <CommandList>
              {isFetching && results.length === 0 ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </div>
              ) : (
                <>
                  <CommandEmpty className="p-4 text-sm text-muted-foreground">
                    No matching items in the catalogue.
                  </CommandEmpty>
                  <CommandGroup>
                    {results.map((item) => (
                      <CommandItem
                        key={item.product_id}
                        value={item.product_id}
                        onSelect={() => {
                          onSelect(item)
                          setQuery('')
                          setIsOpen(false)
                        }}
                        className="flex items-center gap-3 py-2"
                      >
                        <Package className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[item.sku, item.brand_name].filter(Boolean).join(' · ') || '—'}
                            {' · '}
                            {item.pack_size ? `Pack (${item.pack_size} ${item.pack_unit_code ?? item.base_unit_code})` : item.base_unit_code}
                          </div>
                        </div>
                        {item.last_purchase_price !== null && (
                          <div className="shrink-0 text-right text-xs text-muted-foreground">
                            Last: {formatCurrency(item.last_purchase_price)}
                            {item.last_purchase_date && <div>{formatDate(item.last_purchase_date)}</div>}
                          </div>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {query.trim() && (
                <CommandGroup>
                  <CommandItem
                    value={`__add_new__${query}`}
                    onSelect={() => {
                      onAddNew(query.trim())
                      setQuery('')
                      setIsOpen(false)
                    }}
                    className="text-primary"
                  >
                    <Plus className="size-4" /> Add new item "{query.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  )
})
