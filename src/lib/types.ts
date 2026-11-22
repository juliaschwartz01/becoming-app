// Row shapes for every table in supabase/migrations. Keep in sync with the SQL.

export interface Base {
  id: string
  user_id?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  user_id: string
  preferred_name: string | null
  about: string | null
  personal_values: string[]
  priorities: string[]
  communication_style: string | null
  daily_intention: string | null
  intention_date: string | null
  created_at?: string
  updated_at?: string
}

export interface Preferences {
  user_id: string
  dashboard_widgets: string[]
  morning_practices: string[]
  evening_practices: string[]
  affirmations: string[]
  memory_suggestions_enabled: boolean
  settings: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export type GoalStatus = 'active' | 'completed' | 'archived'
export interface Goal extends Base {
  title: string
  description: string | null
  category: string
  status: GoalStatus
  target_date: string | null
  completed_at: string | null
  chapter_id: string | null
}

export interface PlanAction { id: string; text: string; done: boolean }
export interface ManifestationPlan extends Base {
  goal_id: string
  affirmations: string[]
  visualization: string | null
  journaling_prompts: string[]
  gratitude: string | null
  weekly_reflection: string | null
  actions: PlanAction[]
  source: 'manual' | 'ai'
}

export interface LifeChapter extends Base {
  title: string
  description: string | null
  affirmations: string[]
  status: 'upcoming' | 'current' | 'completed'
  start_date: string | null
  end_date: string | null
  cover_image_id: string | null
}

export interface Milestone extends Base {
  title: string
  notes: string | null
  due_date: string | null
  done: boolean
  done_at: string | null
  chapter_id: string | null
  goal_id: string | null
}

export interface Attachment { path: string; name: string; type: string; size: number }
export interface JournalEntry extends Base {
  title: string | null
  body: string
  prompt: string | null
  entry_date: string
  tags: string[]
  favorite: boolean
  chapter_id: string | null
  goal_id: string | null
  attachments: Attachment[]
}

export interface MoodEntry extends Base {
  mood: number
  label: string | null
  energy: number | null
  context: string | null
  themes: string[]
  journal_entry_id: string | null
  recorded_at: string
}

export interface Reflection extends Base {
  kind: string
  title: string
  body: string | null
}

export interface BeliefReflection { id: string; date: string; text: string }
export interface LimitingBelief extends Base {
  belief: string
  origin: string | null
  alternative: string | null
  practice_key: string | null
  status: 'exploring' | 'softening' | 'released'
  reflections: BeliefReflection[]
}

export interface PracticeSession extends Base {
  method_key: string
  content: Record<string, string>
  reflection: string | null
  goal_id: string | null
  completed_at: string
}

export interface MethodNote extends Base { method_key: string; notes: string }

export interface RitualCompletion extends Base {
  ritual_date: string
  period: 'morning' | 'evening'
  practice_key: string
  content: string | null
}

export interface Reminder extends Base {
  title: string
  notes: string | null
  due_at: string
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'
  kind: string
  goal_id: string | null
  done: boolean
  last_done_on: string | null
}

export interface Memory extends Base {
  content: string
  category: string
  origin: 'user' | 'ai_inferred'
  status: 'verified' | 'pending' | 'rejected'
  importance: number
  goal_id: string | null
  source_conversation_id: string | null
}

export type ConversationKind = 'confidante' | 'coach' | 'future_self' | 'library' | 'vision'
export interface Conversation extends Base {
  kind: ConversationKind
  mode: string | null
  title: string
  context: Record<string, unknown>
  goal_id: string | null
  archived: boolean
}

export interface Citation { resource_id: string; passage_id: string; page: number | null; title: string }
export interface Message extends Base {
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations: Citation[]
  memory_ids: string[]
}

export interface VisionBoard extends Base {
  title: string
  category: string
  description: string | null
  background: string
  width: number
  height: number
  goal_id: string | null
  chapter_id: string | null
}

export interface VisionImage extends Base {
  storage_path: string
  title: string | null
  category: string
  board_id: string | null
  source: 'upload' | 'generated'
  prompt: string | null
  width: number | null
  height: number | null
}

export interface BoardElement extends Base {
  board_id: string
  type: 'image' | 'text' | 'affirmation'
  x: number
  y: number
  w: number
  h: number
  rotation: number
  z: number
  content: string | null
  image_id: string | null
  style: { fontSize?: number; color?: string; align?: 'left' | 'center' | 'right'; italic?: boolean; font?: 'display' | 'sans'; fit?: 'cover' | 'contain'; bg?: string }
}

export interface Vision extends Base {
  board_id: string | null
  goal_id: string | null
  description: string
  categories: string[]
}

export interface KnowledgeResource extends Base {
  title: string
  author: string | null
  type: string
  description: string | null
  category: string
  tags: string[]
  url: string | null
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  personal_notes: string | null
  extraction_status: 'none' | 'extracted' | 'manual' | 'unsupported' | 'failed'
  page_count: number | null
  favorite: boolean
}

export interface KnowledgePassage extends Base {
  resource_id: string
  passage_index: number
  page_number: number | null
  content: string
}

export interface PassageHit {
  passage_id: string
  resource_id: string
  resource_title: string
  resource_author: string | null
  resource_type: string
  page_number: number | null
  passage_index: number
  snippet: string
  content: string
  rank: number
}

export interface Achievement extends Base {
  kind: string
  title: string
  description: string | null
  occurred_on: string
  goal_id: string | null
  chapter_id: string | null
  image_id: string | null
  is_breakthrough: boolean
}

export interface MonthlyReview extends Base {
  month: string
  snapshot: Record<string, unknown>
  highlights: string | null
  intention_next: string | null
}

export type TableName =
  | 'profiles' | 'user_preferences' | 'life_chapters' | 'goals' | 'manifestation_plans' | 'milestones'
  | 'journal_entries' | 'mood_entries' | 'reflections' | 'limiting_beliefs' | 'practices' | 'method_notes'
  | 'ritual_completions' | 'reminders' | 'memories' | 'conversations' | 'messages' | 'vision_boards'
  | 'vision_images' | 'vision_board_elements' | 'visions' | 'knowledge_resources' | 'knowledge_passages'
  | 'achievements' | 'monthly_reviews'

export const ALL_TABLES: TableName[] = [
  'profiles', 'user_preferences', 'life_chapters', 'goals', 'manifestation_plans', 'milestones',
  'journal_entries', 'mood_entries', 'reflections', 'limiting_beliefs', 'practices', 'method_notes',
  'ritual_completions', 'reminders', 'memories', 'conversations', 'messages', 'vision_boards',
  'vision_images', 'vision_board_elements', 'visions', 'knowledge_resources', 'knowledge_passages',
  'achievements', 'monthly_reviews',
]

export type Bucket = 'knowledge' | 'vision-images' | 'attachments'
