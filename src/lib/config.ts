// Build-time configuration. Values come from .env.local (on your Mac) or from
// GitHub Actions repository variables (for the live site). None of these are secrets.

/** True in the claude.ai artifact build (`npm run build:artifact`). */
export const isArtifact = (import.meta.env.VITE_TARGET as string | undefined) === 'artifact'

const url = isArtifact ? '' : (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const key = isArtifact ? '' :
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    '').trim()

export const config = {
  supabaseUrl: url,
  supabaseKey: key,
  /** True when the app is connected to a real Supabase project. */
  cloud: Boolean(url && key),
  /** On claude.ai the AI runs on the viewer's own Claude account; on the website only after an approved provider is connected. */
  aiEnabled: isArtifact || (import.meta.env.VITE_AI_ENABLED as string | undefined) === 'true',
  /** Image generation and transcription are separate capabilities with their own switches. */
  imageGenerationEnabled: (import.meta.env.VITE_IMAGE_GENERATION_ENABLED as string | undefined) === 'true',
  transcriptionEnabled: (import.meta.env.VITE_TRANSCRIPTION_ENABLED as string | undefined) === 'true',
}

/** Preview mode: no Supabase configured. Data stays in this browser only. Never used on the live site. */
export const isPreview = !config.cloud && !isArtifact
