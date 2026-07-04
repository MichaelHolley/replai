import type { ModelOption, StylePreset } from './types'

/**
 * Curated shortlist of vision-capable OpenRouter models.
 * All must accept image inputs — free-text model entry is intentionally rejected
 * (see Decision Record). Verify each still accepts images during Milestone 2.
 */
export const MODELS: ModelOption[] = [
  {
    id: 'openai/gpt-5.4-mini',
    label: 'GPT-5.4 mini',
    note: 'Fast & cheap — default'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    note: 'Fast, strong reasoning'
  }
]

export const DEFAULT_MODEL_ID = MODELS[0].id

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
  }
]

export const DEFAULT_PRESET_ID = PRESETS[0].id

export function getModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id)
}

export function getPreset(id: string): StylePreset | undefined {
  return PRESETS.find((p) => p.id === id)
}
