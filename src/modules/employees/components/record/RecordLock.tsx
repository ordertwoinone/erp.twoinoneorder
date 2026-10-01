import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'
import { SECTION_ACCESS, sectionAccess } from '../../recordAccess'
import { RecordLockContext, type RecordLockValue } from './recordLockContext'

/**
 * View mode by default for an existing employee; editing needs the signed-in
 * user's own password (re-checked with Supabase Auth) once per visit to the
 * page. After that, sections unlock individually or all at once.
 */
export function RecordLockProvider({ isNew, children }: { isNew: boolean; children: ReactNode }) {
  const { appContext, hasPermission } = useAuth()
  const [verified, setVerified] = useState(false)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(false)

  const canView = useCallback((key: string) => sectionAccess(key)?.viewAny.some(hasPermission) ?? true, [hasPermission])
  const canEdit = useCallback((key: string) => sectionAccess(key)?.editAny.some(hasPermission) ?? false, [hasPermission])

  const applyUnlock = useCallback(
    (key: string) => {
      const keys = key === 'all' ? SECTION_ACCESS.map((s) => s.key).filter(canEdit) : [key]
      setUnlocked((prev) => new Set([...prev, ...keys]))
    },
    [canEdit],
  )

  const requestUnlock = useCallback(
    (key: string) => {
      if (key !== 'all' && !canEdit(key)) {
        toast.error("You don't have permission to edit this section")
        return
      }
      if (verified) applyUnlock(key)
      else setPending(key)
    },
    [verified, applyUnlock, canEdit],
  )

  async function verify() {
    if (!appContext?.email || !password) return
    setChecking(true)
    const { error } = await supabase.auth.signInWithPassword({ email: appContext.email, password })
    setChecking(false)
    if (error) {
      toast.error('Incorrect password')
      return
    }
    setVerified(true)
    applyUnlock(pending!)
    setPending(null)
    setPassword('')
    toast.success(pending === 'all' ? 'Edit mode on — all sections you can edit are unlocked' : 'Section unlocked')
  }

  const value = useMemo<RecordLockValue>(
    () => ({
      alwaysUnlocked: isNew,
      isUnlocked: (key) => isNew || unlocked.has(key),
      canView,
      canEdit,
      requestUnlock,
      lockAll: () => setUnlocked(new Set()),
      anyUnlocked: isNew || unlocked.size > 0,
    }),
    [isNew, unlocked, canView, canEdit, requestUnlock],
  )

  return (
    <RecordLockContext.Provider value={value}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="size-5 text-primary" /> Enable edit mode
              <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPending(null)} aria-label="Close">
                <X className="size-4" />
              </button>
            </DialogTitle>
            <DialogDescription>Enter your login password. Only sections you're authorised to edit will unlock.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              // React bubbles submit through portals; never let it reach the record form.
              e.stopPropagation()
              void verify()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="unlock-password">Password</Label>
              <div className="relative">
                <Input
                  id="unlock-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!password || checking}>
                {checking && <Loader2 className="animate-spin" />} Unlock
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </RecordLockContext.Provider>
  )
}
