import { supabase } from './supabase'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])

function validateImageFile(file) {
  if (!file || !ACCEPTED.has(file.type)) {
    throw new Error('Unsupported image format')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image is too large (max 5 MB)')
  }
}

export async function resizeImage(file, { maxWidth, maxHeight, quality = 0.85 }) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not read image file'))
      image.src = url
    })
    const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    const width = Math.round(img.width * ratio)
    const height = Math.round(img.height * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is unavailable')
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))),
        'image/jpeg',
        quality
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// We use deterministic paths for easy overwrite and cleanup. Cache-busting
// query params ensure clients/CDN fetch the latest file after re-upload.
function withCacheBust(url) {
  return `${url}?v=${Date.now()}`
}

function normalizeStorageError(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('bucket not found')) {
    return new Error('Image storage is not set up yet. Run supabase db push to apply storage bucket migrations.')
  }
  return error
}

export async function uploadAvatar({ userId, file }) {
  validateImageFile(file)
  const blob = await resizeImage(file, { maxWidth: 512, maxHeight: 512, quality: 0.85 })
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })
  if (error) throw normalizeStorageError(error)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return withCacheBust(data.publicUrl)
}

export async function uploadCircleCover({ circleId, file }) {
  validateImageFile(file)
  const blob = await resizeImage(file, { maxWidth: 1200, maxHeight: 600, quality: 0.85 })
  const path = `${circleId}/cover.jpg`
  const { error } = await supabase.storage
    .from('circle-covers')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })
  if (error) throw normalizeStorageError(error)
  const { data } = supabase.storage.from('circle-covers').getPublicUrl(path)
  return withCacheBust(data.publicUrl)
}

export async function deleteAvatar(userId) {
  const { error } = await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`])
  if (error && !String(error.message || '').toLowerCase().includes('not found')) throw error
}

export async function deleteCircleCover(circleId) {
  const { error } = await supabase.storage.from('circle-covers').remove([`${circleId}/cover.jpg`])
  if (error && !String(error.message || '').toLowerCase().includes('not found')) throw error
}
