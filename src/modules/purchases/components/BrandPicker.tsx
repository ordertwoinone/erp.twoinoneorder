import { useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useBrandsOptions, useQuickCreateBrand } from '@/hooks/useCatalogOptions'
import { cn } from '@/lib/utils'

/** Searchable brand list with "+ Add as new brand" when the typed name isn't there yet. */
export function BrandPicker({ value, onChange }: { value: string; onChange: (brandId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: brands = [] } = useBrandsOptions()
  const createBrand = useQuickCreateBrand()

  const selected = brands.find((b) => b.id === value)
  const typed = search.trim().replace(/\s+/g, ' ')
  const exactMatch = brands.some((b) => b.name.toLowerCase() === typed.toLowerCase())

  async function addBrand() {
    if (!typed) return
    const brand = await createBrand.mutateAsync(typed)
    onChange(brand.id)
    setSearch('')
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <div className="relative">
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.name ?? 'Optional'}</span>
            <ChevronsUpDown className={cn('size-4 opacity-50', selected && 'invisible')} />
          </Button>
        </PopoverTrigger>
        {selected && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear brand"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type a new brand…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!typed && <CommandEmpty className="py-2 text-center text-sm text-muted-foreground">No brands yet.</CommandEmpty>}
            {brands.length > 0 && (
              <CommandGroup>
                {brands.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={b.name}
                    onSelect={() => {
                      onChange(b.id)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Check className={cn('size-4', b.id === value ? 'opacity-100' : 'opacity-0')} />
                    {b.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {typed && !exactMatch && (
              <CommandGroup forceMount>
                <CommandItem forceMount value={`__add__${typed}`} onSelect={() => void addBrand()} disabled={createBrand.isPending} className="text-primary">
                  {createBrand.isPending ? <Loader2 className="animate-spin" /> : <Plus className="text-primary" />}
                  Add “{typed}” as new brand
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
