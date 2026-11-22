// Build-time configuration. Values come from .env.local (on your Mac) or from
// GitHub Actions repository variables (for the live site). None of these are secrets.

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const key =
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    '').trim()

export const config = {
  supabaseUrl: url,
  supabaseKey: key,
  /** True when the app is connected to a real Supabase project. */
  cloud: Boolean(url && key),
  /** Only true after an AI provider has been approved and deployed as a Supabase Edge Function. */
  aiEnabled: (import.meta.env.VITE_AI_ENABLED as string | undefined) === 'true',
  /** Image generation and transcription are separate capabilities with their own switches. */
  imageGenerationEnabled: (import.meta.env.VITE_IMAGE_GENERATION_ENABLED as string | undefined) === 'true',
  transcriptionEnabled: (import.meta.env.VITE_TRANSCRIPTION_ENABLED as string | undefined) === 'true',
}

/** Preview mode: no Supabase configured. Data stays in this browser only. Never used on the live site. */
export const isPreview = !config.cloud
