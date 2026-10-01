import { createContext, useContext } from 'react'

export interface RecordLockValue {
  /** True for a brand-new employee: nothing to protect yet, so everything is editable. */
  alwaysUnlocked: boolean
  isUnlocked: (sectionKey: string) => boolean
  canView: (sectionKey: string) => boolean
  canEdit: (sectionKey: string) => boolean
  /** Asks for the password once per visit, then unlocks the section (or all with 'all'). */
  requestUnlock: (sectionKey: string | 'all') => void
  lockAll: () => void
  anyUnlocked: boolean
}

export const RecordLockContext = createContext<RecordLockValue | null>(null)

export function useRecordLock() {
  const ctx = useContext(RecordLockContext)
  if (!ctx) throw new Error('useRecordLock must be used within RecordLockProvider')
  return ctx
}
