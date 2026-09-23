import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRestaurantsQuery } from '@/hooks/useRestaurantsQuery'
import { useProfileAssignmentsQuery, useRolesQuery, useUpdateUserAssignments } from '../hooks/useUserAdmin'

interface Profile {
  id: string
  full_name: string
  email: string
  status: 'active' | 'inactive' | 'suspended'
}

export function UserAccessDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: Profile | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: roles } = useRolesQuery()
  const { data: allRestaurants } = useRestaurantsQuery()
  const { data: assignments } = useProfileAssignmentsQuery(profile?.id)
  const updateAssignments = useUpdateUserAssignments()

  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [restaurantIds, setRestaurantIds] = useState<string[]>([])

  useEffect(() => {
    if (profile) setStatus(profile.status)
    if (assignments) {
      setRoleIds(assignments.roleIds)
      setRestaurantIds(assignments.restaurantIds)
    }
  }, [profile, assignments])

  const selectedIsAllRestaurants = roles?.some((r) => roleIds.includes(r.id) && r.is_all_restaurants) ?? false

  async function handleSave() {
    if (!profile) return
    await updateAssignments.mutateAsync({ profileId: profile.id, status, roleIds, restaurantIds })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile?.full_name}</DialogTitle>
          <DialogDescription>{profile?.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Account status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="space-y-2 rounded-md border p-3">
              {roles?.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleIds.includes(role.id)}
                    onCheckedChange={(checked) =>
                      setRoleIds((prev) => (checked ? [...prev, role.id] : prev.filter((id) => id !== role.id)))
                    }
                  />
                  {role.name}
                  {role.is_all_restaurants && <span className="text-xs text-muted-foreground">(all restaurants)</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Restaurant access</Label>
            {selectedIsAllRestaurants ? (
              <p className="text-sm text-muted-foreground">
                This user's role already grants access to all restaurants.
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {allRestaurants?.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={restaurantIds.includes(r.id)}
                      onCheckedChange={(checked) =>
                        setRestaurantIds((prev) => (checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={updateAssignments.isPending}>
            {updateAssignments.isPending && <Loader2 className="animate-spin" />}
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
