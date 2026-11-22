import { db, uuid } from './db'
import { requireUserId } from './auth'
import { imageSize } from './board'
import type { VisionImage } from './types'
import { safeFileName } from './utils'

const MAX = 20 * 1024 * 1024

/**
 * Save an image the user chose to keep into the private "vision-images" bucket.
 * (Never used for temporary reference photos of the user.)
 */
export async function saveVisionImage(file: Blob, opts: { name?: string; category?: string; board_id?: string | null; source?: 'upload' | 'generated'; prompt?: string | null; title?: string | null }): Promise<VisionImage> {
  if (file.size > MAX) throw new Error('Images must be under 20 MB.')
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.')
  const { width, height } = await imageSize(file)
  const name = safeFileName(opts.name || `image.${file.type.split('/')[1] || 'png'}`)
  const path = await db.upload('vision-images', `${requireUserId()}/${uuid()}-${name}`, file, file.type)
  try {
    return await db.insert<VisionImage>('vision_images', {
      storage_path: path, title: opts.title ?? null, category: opts.category ?? 'lifestyle', board_id: opts.board_id ?? null,
      source: opts.source ?? 'upload', prompt: opts.prompt ?? null, width, height,
    })
  } catch (e) {
    await db.removeFiles('vision-images', [path]).catch(() => {})
    throw e
  }
}

export async function deleteVisionImage(img: VisionImage) {
  await db.remove('vision_images', img.id) // removes it from boards too (cascade)
  await db.removeFiles('vision-images', [img.storage_path])
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
