import { z } from 'zod'

export const transferItemSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  unit_id: z.string().uuid('Select a unit'),
  quantity: z.coerce.number().gt(0, 'Quantity must be greater than 0'),
})

export const branchTransferFormSchema = z
  .object({
    from_restaurant_id: z.string().uuid('Select the source restaurant'),
    to_restaurant_id: z.string().uuid('Select the destination restaurant'),
    notes: z.string().optional().or(z.literal('')),
    items: z.array(transferItemSchema).min(1, 'Add at least one item'),
  })
  .refine((data) => data.from_restaurant_id !== data.to_restaurant_id, {
    message: 'Source and destination must differ',
    path: ['to_restaurant_id'],
  })

export type BranchTransferFormInput = z.infer<typeof branchTransferFormSchema>
