import type { ModelOption } from './types'

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

export function getModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id)
}
