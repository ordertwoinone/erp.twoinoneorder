import { supabase } from '@/lib/supabase/client'

const BUCKET = 'product-images'
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

/** Public URL for a product photo (the bucket is public — product photos aren't sensitive). */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function validateProductImage(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Use a JPG, PNG or WebP photo.'
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return 'The photo is larger than 5 MB.'
  return null
}

/** Uploads a product photo and returns its storage path. */
export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw new Error(`Photo upload failed: ${error.message}`)
  return path
}
