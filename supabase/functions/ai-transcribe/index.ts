// =============================================================================
// ai-transcribe — optional transcription of uploaded audio/video. NOT CONNECTED.
// When connected it should: download the file from the private "knowledge" bucket
// with the caller's own permissions, send it to the approved provider, and return
// { text, segments }. The app then stores the text as searchable passages.
// =============================================================================
import { cors, notConfigured, requireUser } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    await requireUser(req)
    return notConfigured('A transcription service')
  } catch (e) {
    if (e instanceof Response) return e
    return new Response(JSON.stringify({ error: 'failed' }), { status: 500, headers: cors })
  }
})
