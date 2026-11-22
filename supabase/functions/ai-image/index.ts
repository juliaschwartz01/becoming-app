// =============================================================================
// ai-image — image generation for vision boards. NOT CONNECTED.
//
// Privacy rules this function must keep when a provider is added:
//   * Reference photos arrive in the request body only. Never write them to
//     Storage, the database, logs, or anywhere else. Discard after the call.
//   * Return generated images to the browser; only images the owner chooses to
//     "Keep" are saved (by the app) to the private "vision-images" bucket.
//   * Before enabling, document the provider's own processing and retention policy.
// =============================================================================
import { cors, notConfigured, requireUser } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    await requireUser(req)
    return notConfigured('An image-generation model')
  } catch (e) {
    if (e instanceof Response) return e
    return new Response(JSON.stringify({ error: 'failed' }), { status: 500, headers: cors })
  }
})
