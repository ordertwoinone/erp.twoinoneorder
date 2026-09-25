import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { usePeriodScope } from '../hooks/usePeriodScope'

export function PeriodSelector({ period }: { period: ReturnType<typeof usePeriodScope> }) {
  return (
    <div className="flex items-center gap-1 rounded-md border px-1 py-1">
      <Button variant="ghost" size="icon" className="size-7" onClick={period.goToPrevMonth} aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Button>
      <button
        type="button"
        onClick={period.goToCurrentMonth}
        className="min-w-24 px-2 text-center text-sm font-medium hover:text-primary"
      >
        {period.label}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={period.goToNextMonth}
        disabled={period.isCurrentMonth}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
