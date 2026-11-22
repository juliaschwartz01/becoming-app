// Static content shipped with the app. Nothing personal lives here.

export const CATEGORIES = [
  { key: 'career', label: 'Career' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'health', label: 'Health & wellness' },
  { key: 'travel', label: 'Travel' },
  { key: 'personal-growth', label: 'Personal growth' },
  { key: 'future-self', label: 'Future self' },
] as const
export const categoryLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k

export const CATEGORY_TONES: Record<string, string> = {
  career: '#d9cdbb', lifestyle: '#ecdcd3', relationships: '#efd9d2', confidence: '#e7d3c4',
  health: '#d8e0cf', travel: '#d6dcd8', 'personal-growth': '#e3e4d4', 'future-self': '#e9e0ea',
}

export interface RitualPractice { key: string; label: string; prompt: string; mood?: boolean }
export const MORNING_PRACTICES: RitualPractice[] = [
  { key: 'gratitude', label: 'Gratitude', prompt: 'Three things I’m grateful for this morning…' },
  { key: 'affirmation', label: 'Affirmation', prompt: 'The affirmation I’m choosing to live today…' },
  { key: 'visualization', label: 'Visualization', prompt: 'Close your eyes for two minutes. What did you see and feel?' },
  { key: 'intention', label: 'Daily intention', prompt: 'Today, I intend to…' },
  { key: 'action', label: 'One small action', prompt: 'One small, concrete step toward my goals today…' },
]
export const EVENING_PRACTICES: RitualPractice[] = [
  { key: 'reflect', label: 'Reflect on my day', prompt: 'What stood out about today?' },
  { key: 'mood', label: 'Record my mood', prompt: 'How am I feeling as the day closes?', mood: true },
  { key: 'wins', label: 'Celebrate small wins', prompt: 'Small wins worth celebrating…' },
  { key: 'gratitude', label: 'Express gratitude', prompt: 'Tonight I’m thankful for…' },
  { key: 'release', label: 'Release worries', prompt: 'What I’m ready to set down for tonight…' },
]

export const REFLECTION_PROMPTS = [
  'What would the most grounded version of me do with today?',
  'Where did I feel most like myself this week?',
  'What am I quietly proud of that no one else knows about?',
  'Which belief about myself is ready to be retired?',
  'What does “enough” look like for me right now?',
  'Who makes me feel expansive, and why?',
  'What would I attempt if I trusted myself completely?',
  'What small pleasure did I nearly overlook today?',
  'What is one thing I can stop waiting for permission to do?',
  'If my future self wrote me a note today, what would it say?',
  'What drained me this week, and what restored me?',
  'Which part of my life feels most alive right now?',
  'What am I learning about the way I love?',
  'How do I want to feel when I walk into a room?',
  'Where am I being asked to be braver?',
  'What would make this season of my life feel beautiful?',
  'What story about my past am I ready to tell differently?',
  'What does my body need from me this week?',
  'What have I already outgrown?',
  'What would I like to remember about this month?',
]

export const DEFAULT_AFFIRMATIONS = [
  'I am becoming who I imagine, one quiet choice at a time.',
  'I am allowed to take up space and to want beautiful things.',
  'My life is unfolding with ease, and I meet it with confidence.',
  'I trust myself to handle what today brings.',
  'I move through the world with grace and self-respect.',
  'Good things are allowed to be easy for me.',
  'I am worthy of the life I’m building.',
  'I choose calm. I choose clarity. I choose myself.',
  'Every day I feel more at home in who I am.',
  'I keep promises to myself, gently and consistently.',
]

export const JOURNAL_PROMPTS = [
  'Today I noticed…',
  'Something I want to remember is…',
  'I felt most at ease when…',
  'A conversation that stayed with me…',
  'What I need right now is…',
  'If I were being completely honest…',
  'I am becoming someone who…',
  'A fear I’m holding, and what it’s protecting…',
  'Describe a perfect ordinary day in your future life.',
  'What would you tell a friend in your situation?',
]

export const MOODS = [
  { value: 1, label: 'Heavy', tone: '#c9bcb0' },
  { value: 2, label: 'Tender', tone: '#d9c3bb' },
  { value: 3, label: 'Steady', tone: '#d8d6c6' },
  { value: 4, label: 'Bright', tone: '#c8d3bb' },
  { value: 5, label: 'Radiant', tone: '#b7c6a6' },
]
export const MOOD_WORDS = ['calm', 'hopeful', 'grateful', 'inspired', 'proud', 'loved', 'tired', 'anxious', 'overwhelmed', 'restless', 'lonely', 'sad', 'frustrated', 'content', 'excited', 'focused']

export const REFLECTION_KINDS = [
  { key: 'motivation', label: 'What motivates me' },
  { key: 'learning', label: 'Things I’m learning' },
  { key: 'realization', label: 'Personal realizations' },
  { key: 'fear', label: 'Fears I’m working through' },
  { key: 'practice', label: 'Practices that help me' },
]

export const EVIDENCE_KINDS = [
  { key: 'achievement', label: 'Achievement' },
  { key: 'compliment', label: 'Compliment' },
  { key: 'memory', label: 'Happy memory' },
  { key: 'victory', label: 'Personal victory' },
  { key: 'challenge', label: 'Challenge overcome' },
  { key: 'courage', label: 'Moment of courage' },
]

export const MEMORY_CATEGORIES = [
  { key: 'about-me', label: 'About me' },
  { key: 'preference', label: 'Preference' },
  { key: 'value', label: 'Value' },
  { key: 'goal', label: 'Goal or dream' },
  { key: 'relationship', label: 'People in my life' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'reflection', label: 'Reflection' },
]

export const RESOURCE_TYPES = [
  { key: 'pdf', label: 'PDF' },
  { key: 'book', label: 'Book' },
  { key: 'document', label: 'Document' },
  { key: 'note', label: 'Personal note' },
  { key: 'quote', label: 'Quote' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'article', label: 'Article' },
  { key: 'video', label: 'Video' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'screenshot', label: 'Screenshot' },
]
export const RESOURCE_CATEGORIES = ['manifestation', 'self-concept', 'law of assumption', 'mindset', 'confidence', 'spirituality', 'psychology', 'wellness', 'career', 'relationships', 'other']

export const CONFIDANTE_MODES = [
  { key: 'talk', label: 'I just want to talk', hint: 'Listen warmly, without rushing to fix.' },
  { key: 'reflect', label: 'Help me reflect', hint: 'Ask thoughtful questions that help me see clearly.' },
  { key: 'perspective', label: 'Give me perspective', hint: 'Offer a wider, balanced view.' },
  { key: 'challenge', label: 'Challenge my thinking', hint: 'Gently question my assumptions.' },
  { key: 'ground', label: 'Help me feel grounded', hint: 'Slow down, breathe, and steady me.' },
  { key: 'celebrate', label: 'Celebrate with me', hint: 'Share the joy and help me savour it.' },
]

export const COACH_STARTERS = [
  'How can I work on my self-concept?',
  'Guide me through manifestation scripting.',
  'Help me visualize my future.',
  'What practices should I do today?',
  'What can I learn from the manifestation book I uploaded?',
  'Help me overcome self-doubt.',
  'Create a manifestation routine for this specific goal.',
]

export const FUTURE_AREAS = ['Career', 'Home', 'Love', 'Friendships', 'Health', 'Money', 'Travel', 'Confidence', 'Daily life', 'Creativity']

export const TIMELINE_KINDS = ['achievement', 'milestone', 'journal', 'memory', 'goal', 'breakthrough'] as const

// ---------------------------------------------------------------------------
// Manifestation methods
// ---------------------------------------------------------------------------
export interface MethodField { key: string; label: string; placeholder?: string; rows?: number; repeat?: number }
export interface Method {
  key: string
  title: string
  subtitle: string
  explanation: string
  steps: string[]
  fields: MethodField[]
  /** What psychology research actually says (kept separate from the spiritual framing). */
  research: string
  /** Where the idea comes from in spiritual / manifestation teaching. */
  tradition: string
  tone: string
}

export const METHODS: Method[] = [
  {
    key: 'visualization',
    title: 'Visualization',
    subtitle: 'Rehearse the life you want, in vivid detail',
    explanation: 'Visualization is the practice of imagining a desired scene as if it is happening now — engaging sight, sound, touch and emotion — so the future feels familiar rather than far away.',
    steps: [
      'Find a quiet place and settle your breathing for a minute.',
      'Choose one specific scene that would imply your goal has happened.',
      'Make it sensory: where are you, what do you hear, what are you wearing?',
      'Feel the emotion of the scene — relief, joy, calm, pride.',
      'Then name one realistic obstacle and how you’d meet it.',
      'Open your eyes and write what you saw.',
    ],
    fields: [
      { key: 'scene', label: 'The scene I imagined', rows: 5, placeholder: 'I’m standing in my apartment as the morning light…' },
      { key: 'feeling', label: 'How it felt', rows: 2 },
      { key: 'obstacle', label: 'An obstacle, and how I’d meet it', rows: 3 },
    ],
    research: 'Mental rehearsal is well studied in sports and skills psychology and can improve performance. Research on “mental contrasting” (Gabriele Oettingen) suggests purely positive fantasies can reduce effort, while pairing the wish with realistic obstacles and a plan tends to help people act.',
    tradition: 'In manifestation teaching, visualization is used to make a desire feel already real, with the belief that this alignment draws it closer.',
    tone: '#e7dcd0',
  },
  {
    key: 'scripting',
    title: 'Scripting',
    subtitle: 'Write your future as if it has already happened',
    explanation: 'Scripting means writing a journal entry from a future day, in the present or past tense, describing your life once your desires are real.',
    steps: [
      'Pick a date in the future and write it at the top.',
      'Write in the first person, as though it is that day.',
      'Describe events, feelings and small details as already true.',
      'Write with gratitude, as if thanking life for what happened.',
      'Read it back slowly and notice how it feels.',
    ],
    fields: [
      { key: 'date', label: 'The future date I’m writing from', rows: 1, placeholder: 'September 14, 2028' },
      { key: 'script', label: 'My script', rows: 10, placeholder: 'I can’t believe how much has changed…' },
    ],
    research: 'Expressive and “best possible self” writing exercises have been linked in studies to small improvements in optimism and mood. These studies measure how people feel, not whether external events change.',
    tradition: 'Popular in law-of-attraction and law-of-assumption communities as a way to “live in the end.”',
    tone: '#ecdcd3',
  },
  {
    key: 'affirmations',
    title: 'Affirmations',
    subtitle: 'Words you choose to return to',
    explanation: 'Affirmations are short statements you repeat to reinforce how you want to see yourself and your life.',
    steps: [
      'Write affirmations in the present tense and in your own voice.',
      'Choose statements that feel believable — or “I am learning to…” versions.',
      'Say them slowly, ideally aloud, and pause after each.',
      'Notice any resistance; that’s useful information, not failure.',
    ],
    fields: [
      { key: 'affirmations', label: 'Today’s affirmations', rows: 5, placeholder: 'I am…' },
      { key: 'resistance', label: 'Any resistance I noticed', rows: 2 },
    ],
    research: 'Self-affirmation research (affirming your core values) shows reduced defensiveness and stress in some studies. One well-known study found that very strong positive statements could make people with low self-esteem feel worse — believable, values-based wording tends to work better.',
    tradition: 'A foundational practice in New Thought and manifestation teaching, used to reshape inner dialogue.',
    tone: '#efe2d6',
  },
  {
    key: 'gratitude',
    title: 'Gratitude',
    subtitle: 'Notice what is already good',
    explanation: 'A gratitude practice means deliberately noticing and recording things you appreciate, large or small.',
    steps: [
      'Write three to five specific things you’re grateful for.',
      'For one of them, write why it matters to you.',
      'Let yourself feel it for a few breaths before moving on.',
    ],
    fields: [
      { key: 'list', label: 'I am grateful for…', rows: 5 },
      { key: 'why', label: 'Why one of them matters', rows: 3 },
    ],
    research: 'Gratitude journaling has been associated with modest improvements in wellbeing in several studies. Effects are generally small to moderate and vary between people.',
    tradition: 'In manifestation teaching, gratitude is seen as a state that aligns you with abundance.',
    tone: '#e3e4d4',
  },
  {
    key: 'self-concept',
    title: 'Self-concept work',
    subtitle: 'Gently update the story of who you are',
    explanation: 'Self-concept work explores the beliefs you hold about yourself and deliberately practises a kinder, more expansive identity.',
    steps: [
      'Write one thing you currently believe about yourself.',
      'Ask: where did this come from, and is it fully true?',
      'Write the identity you’d like to grow into.',
      'List evidence — even small — that this new identity is already present.',
      'Choose one action today that the new you would take.',
    ],
    fields: [
      { key: 'current', label: 'A belief I hold about myself', rows: 2 },
      { key: 'new', label: 'Who I’m choosing to become', rows: 3 },
      { key: 'evidence', label: 'Evidence it’s already true', rows: 4 },
      { key: 'action', label: 'One aligned action today', rows: 2 },
    ],
    research: 'Self-concept and self-esteem are studied in psychology. Research on self-compassion (e.g., Kristin Neff) links a kinder inner voice with resilience. Looking for real evidence of a new identity is a reflective habit, not a guarantee of change.',
    tradition: 'Central in Neville Goddard’s teachings and modern law-of-assumption communities: “change your self-concept, change your life.”',
    tone: '#e7d3c4',
  },
  {
    key: 'limiting-beliefs',
    title: 'Limiting belief reflection',
    subtitle: 'Look kindly at what holds you back',
    explanation: 'This practice helps you notice a belief that might be limiting you, understand it, and write a more balanced alternative.',
    steps: [
      'Name the belief in a single sentence.',
      'Write where you think it came from.',
      'List evidence for and against it.',
      'Write a balanced, believable alternative.',
      'You can save it to your Limiting Beliefs page to keep returning to it.',
    ],
    fields: [
      { key: 'belief', label: 'The belief', rows: 2 },
      { key: 'origin', label: 'Where it might come from', rows: 3 },
      { key: 'against', label: 'Evidence against it', rows: 3 },
      { key: 'alternative', label: 'A healthier alternative', rows: 3 },
    ],
    research: 'This resembles cognitive restructuring from cognitive behavioural therapy (CBT), which has strong evidence when delivered by trained professionals. Used here, it is a self-reflection exercise, not therapy.',
    tradition: 'In manifestation teaching, limiting beliefs are seen as resistance that blocks what you desire.',
    tone: '#d8e0cf',
  },
  {
    key: 'law-of-assumption',
    title: 'Law of assumption',
    subtitle: 'Live from the feeling of the wish fulfilled',
    explanation: 'The law of assumption teaches that assuming your desire is already yours — and persisting in that assumption — shapes your experience.',
    steps: [
      'Name your desire clearly.',
      'Ask: “What would I feel if this were already true?”',
      'Imagine a short scene that implies it’s done (e.g., a friend congratulating you).',
      'Loop the scene until it feels natural, then let it go.',
      'Throughout the day, notice and revise thoughts that contradict it.',
    ],
    fields: [
      { key: 'desire', label: 'My desire', rows: 2 },
      { key: 'scene', label: 'The scene that implies fulfilment', rows: 4 },
      { key: 'revision', label: 'A thought I revised today', rows: 3 },
    ],
    research: 'There is no scientific evidence that assumptions change external events. Some people find the practice supports confidence, focus and behaviour, which can influence outcomes indirectly.',
    tradition: 'Taught by Neville Goddard in the mid-20th century and widely shared in online manifestation communities today.',
    tone: '#e9e0ea',
  },
  {
    key: 'future-self',
    title: 'Future-self journaling',
    subtitle: 'Write to and from the person you’re becoming',
    explanation: 'Future-self journaling builds a relationship with a future version of you — asking what they know, how they live, and what they’d tell you now.',
    steps: [
      'Picture yourself a few years from now, at your best.',
      'Describe their day, their habits, and how they carry themselves.',
      'Write a letter from your future self to you today.',
      'Choose one of their habits to practise this week.',
    ],
    fields: [
      { key: 'her', label: 'Who my future self is', rows: 4 },
      { key: 'letter', label: 'A letter from my future self', rows: 7 },
      { key: 'habit', label: 'One habit to practise this week', rows: 2 },
    ],
    research: 'Research on “future self-continuity” (e.g., Hal Hershfield) suggests that feeling connected to your future self is associated with better long-term decisions such as saving.',
    tradition: 'Popular in modern coaching and manifestation spaces as “becoming your future self.”',
    tone: '#e6ddd3',
  },
  {
    key: 'intention',
    title: 'Intention setting',
    subtitle: 'Choose how you want to show up',
    explanation: 'An intention is a clear choice about how you want to feel or act. Paired with a simple “if–then” plan, it becomes easier to follow through.',
    steps: [
      'Write your intention for today or this week.',
      'Name a situation where it will matter.',
      'Write an if–then plan: “If ___ happens, then I will ___.”',
    ],
    fields: [
      { key: 'intention', label: 'My intention', rows: 2 },
      { key: 'ifthen', label: 'If… then I will…', rows: 3 },
    ],
    research: '“Implementation intentions” (Peter Gollwitzer) — specific if–then plans — have strong research support for improving follow-through on goals.',
    tradition: 'Intention setting is common in yoga, mindfulness and manifestation practice as a way of directing energy.',
    tone: '#efe6d8',
  },
  {
    key: '369',
    title: '369 journaling',
    subtitle: 'Three, six and nine repetitions through the day',
    explanation: 'Write your affirmation or desire 3 times in the morning, 6 times in the afternoon and 9 times in the evening, for a chosen number of days.',
    steps: [
      'Choose a single, present-tense statement.',
      'Morning: write it 3 times.',
      'Afternoon: write it 6 times.',
      'Evening: write it 9 times.',
      'Repeat for 33 or 45 days if you like, without forcing it.',
    ],
    fields: [
      { key: 'statement', label: 'My statement', rows: 2 },
      { key: 'morning', label: 'Morning', rows: 1, repeat: 3 },
      { key: 'afternoon', label: 'Afternoon', rows: 1, repeat: 6 },
      { key: 'evening', label: 'Evening', rows: 1, repeat: 9 },
    ],
    research: 'There is no scientific research on the 369 method specifically. Repetition can help keep a goal in mind; any benefit likely comes from attention and reflection.',
    tradition: 'A social-media practice loosely attributed to Nikola Tesla’s interest in the numbers 3, 6 and 9 (that link is folklore).',
    tone: '#e8ddcf',
  },
]
export const methodByKey = (k: string | null | undefined) => METHODS.find((m) => m.key === k)

export const MANIFESTATION_DISCLAIMER =
  'Manifestation practices are reflective and spiritual tools. They can support focus, mood and motivation, but they do not guarantee any particular outcome.'
