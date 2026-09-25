import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UseFormReturn } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { Building2, IdCard, Loader2, Search, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { RestaurantOption } from '@/hooks/useRestaurantsQuery'
import type { EmployeeRecordInput } from '@/schemas/employee'
import { DOCUMENT_TYPES } from '../../employeeOptions'
import { searchEmployees } from '../../hooks/useEmployeeRecord'
import { Field, IconInput, OptionSelect } from './RecordUi'

type Match = Awaited<ReturnType<typeof searchEmployees>>[number]

export function EmployeeHeaderSection({
  form,
  restaurants,
  docFilter,
  onDocFilterChange,
}: {
  form: UseFormReturn<EmployeeRecordInput>
  restaurants: RestaurantOption[]
  docFilter: string
  onDocFilterChange: (value: string) => void
}) {
  const navigate = useNavigate()
  const { register, control, getValues, formState } = form
  const [matches, setMatches] = useState<Match[]>([])
  const [searching, setSearching] = useState(false)

  async function handleSearch() {
    const term = getValues('employee_code') || getValues('full_name')
    if (!term?.trim()) {
      toast.info('Type an employee name or ID to search')
      return
    }
    setSearching(true)
    try {
      const found = await searchEmployees(term, getValues('id'))
      if (found.length === 0) toast.info('No existing employee found — fill in the form to add a new one.')
      else if (found.length === 1) navigate(`/employees/${found[0].id}`)
      else setMatches(found)
    } catch (error) {
      toast.error('Search failed', { description: (error as Error).message })
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">Employee Details / Renewal &amp; Settlement</h1>
      <Popover open={matches.length > 0} onOpenChange={(open) => !open && setMatches([])}>
        <PopoverAnchor asChild>
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Field label="Employee name" error={formState.errors.full_name?.message}>
              <IconInput icon={User} placeholder="Full name" {...register('full_name')} />
            </Field>
            <Field label="Employee ID">
              <IconInput icon={IdCard} placeholder="Auto-generated if blank" {...register('employee_code')} />
            </Field>
            <Field label="Branch" error={formState.errors.current_restaurant_id?.message}>
              <Controller
                control={control}
                name="current_restaurant_id"
                render={({ field }) => (
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                    <OptionSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={restaurants.map((r) => ({ value: r.id, label: r.name }))}
                      placeholder="Select branch"
                      className="pl-9"
                    />
                  </div>
                )}
              />
            </Field>
            <Field label="Document type filter">
              <OptionSelect
                value={docFilter}
                onChange={onDocFilterChange}
                options={[{ value: 'all', label: 'All document types' }, ...DOCUMENT_TYPES]}
                placeholder="All document types"
              />
            </Field>
            <Button type="button" size="icon" className="size-10" onClick={handleSearch} disabled={searching} aria-label="Find employee">
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-80 p-1">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Existing employees matching your search</p>
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/employees/${m.id}`)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="truncate font-medium">{m.full_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {m.employee_code} · {m.restaurants?.name ?? '—'}
              </span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </section>
  )
}
