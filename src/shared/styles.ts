import type { StylePreset } from './types'

/** Predefined writing-style presets (custom presets deferred to v2). */
export const PRESETS: StylePreset[] = [
  {
    id: 'professional',
    label: 'Professional',
    instruction:
      'polished and professional — clear, courteous, and free of slang'
  },
  {
    id: 'casual',
    label: 'Casual',
    instruction: 'relaxed and casual — friendly, conversational, everyday tone'
  },
  {
    id: 'flirty',
    label: 'Flirty',
    instruction: 'playful and flirty — warm, teasing, and lightly charming'
  },
  {
    id: 'concise',
    label: 'Concise',
    instruction: 'brief and to the point — the shortest reply that works'
  },
  {
    id: 'corporate',
    label: 'Corporate',
    instruction:
      'buzzword-heavy corporate jargon — lean on terms like synergy, alignment, ' +
      'bandwidth, circle back, low-hanging fruit, and stakeholder value, while ' +
      'still clearly conveying the same underlying message'
  }
]

export const DEFAULT_PRESET_ID = PRESETS[0].id

export function getPreset(id: string): StylePreset | undefined {
  return PRESETS.find((p) => p.id === id)
}
