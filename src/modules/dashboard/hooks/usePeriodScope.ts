import { addMonths, endOfMonth, format, isSameMonth, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'

/** Month-based period picker for the dashboard's date-range selector. */
export function usePeriodScope() {
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))

  return useMemo(() => {
    const periodStartDate = startOfMonth(monthAnchor)
    const periodEndDate = endOfMonth(monthAnchor)
    const today = new Date()
    return {
      periodStart: format(periodStartDate, 'yyyy-MM-dd'),
      periodEnd: format(periodEndDate > today ? today : periodEndDate, 'yyyy-MM-dd'),
      label: format(monthAnchor, 'MMM yyyy'),
      isCurrentMonth: isSameMonth(monthAnchor, today),
      goToPrevMonth: () => setMonthAnchor((m) => startOfMonth(addMonths(m, -1))),
      goToNextMonth: () => setMonthAnchor((m) => startOfMonth(addMonths(m, 1))),
      goToCurrentMonth: () => setMonthAnchor(startOfMonth(today)),
    }
  }, [monthAnchor])
}
