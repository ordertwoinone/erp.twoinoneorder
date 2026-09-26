import { cn } from '@/lib/utils'

const PALETTE = [
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-lime-100 text-lime-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
]

function hash(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** Products have no photos yet, so each item gets an initials tile coloured by its category. */
export function ItemThumb({ name, category, className }: { name: string; category?: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
        PALETTE[hash(category || name) % PALETTE.length],
        className,
      )}
      aria-hidden
    >
      {initials || '?'}
    </div>
  )
}
