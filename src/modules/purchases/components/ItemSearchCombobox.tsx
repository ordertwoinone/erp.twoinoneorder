import { forwardRef, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Plus, Search } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Command as CommandPrimitive } from 'cmdk'
import { formatCurrency } from '@/lib/utils/format'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useItemSearchQuery, type ItemSearchResult } from '../hooks/useItemSearch'
import { ItemThumb } from './ItemThumb'

interface ItemSearchComboboxProps {
  supplierId: string | null
  restaurantId: string | null
  categoryId: string | null
  onSelect: (item: ItemSearchResult) => void
  onAddNew: (name: string) => void
}

export function packText(item: Pick<ItemSearchResult, 'pack_size' | 'pack_unit_code' | 'base_unit_code'>) {
  return item.pack_size ? `Pack (${item.pack_size} ${item.pack_unit_code ?? item.base_unit_code})` : item.base_unit_code
}

export const ItemSearchCombobox = forwardRef<HTMLInputElement, ItemSearchComboboxProps>(function ItemSearchCombobox(
  { supplierId, restaurantId, categoryId, onSelect, onAddNew },
  ref,
) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query, 250)
  const disabled = !supplierId || !restaurantId

  const { data: results = [], isFetching } = useItemSearchQuery(supplierId, restaurantId, debouncedQuery, categoryId)

  useEffect(() => {
    function handleClickOutside() {
      setIsOpen(false)
    }
    if (isOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="flex h-10 items-center gap-2 rounded-lg border-2 border-primary/60 bg-background px-3 focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={ref}
            value={query}
            onValueChange={(v) => {
              setQuery(v)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={disabled ? 'Select a restaurant and supplier first…' : 'Search by item name, SKU, brand or barcode…'}
            disabled={disabled}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
            Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd> to focus
          </span>
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full z-30 mt-1 w-full overflow-hidden sm:min-w-md rounded-lg border bg-popover shadow-lg">
            <CommandList className="max-h-96">
              {isFetching && results.length === 0 ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </div>
              ) : (
                <>
                  <CommandEmpty className="p-4 text-sm text-muted-foreground">No matching items in the catalogue.</CommandEmpty>
                  <CommandGroup className="p-0">
                    {results.map((item) => (
                      <CommandItem
                        key={item.product_id}
                        value={item.product_id}
                        onSelect={() => {
                          onSelect(item)
                          setQuery('')
                          setIsOpen(false)
                        }}
                        className="flex items-center gap-3 rounded-none border-b px-3 py-2.5 last:border-0"
                      >
                        <ItemThumb name={item.name} category={item.category_name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[item.sku && `SKU: ${item.sku}`, item.brand_name, item.category_name].filter(Boolean).join('  |  ') || '—'}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <div>{packText(item)}</div>
                          <div>
                            {item.last_purchase_price !== null ? `Last purchase: ${formatCurrency(item.last_purchase_price)}` : 'No previous purchase'}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {query.trim() && (
                <CommandGroup className="border-t">
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
