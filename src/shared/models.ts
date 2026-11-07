import type { ModelOption, ProviderId } from './types'

/**
 * Curated shortlist of vision-capable models per provider.
 * All must accept image inputs — free-text model entry is intentionally rejected
 * (see Decision Record). The first model of each provider is its default.
 */
export const MODELS: ModelOption[] = [
  {
    id: 'openai/gpt-5.4-mini',
    provider: 'openrouter',
    label: 'GPT-5.4 mini',
    note: 'Fast & cheap — default'
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    provider: 'openrouter',
    label: 'Claude Haiku 4.5',
    note: 'Fast, strong reasoning'
  },
  // Claude Code aliases always resolve to the latest model of that family.
  {
    id: 'haiku',
    provider: 'claude-code',
    label: 'Claude Haiku',
    note: 'Fast — default'
  },
  {
    id: 'sonnet',
    provider: 'claude-code',
    label: 'Claude Sonnet',
    note: 'Slower, more nuanced'
  }
]

export const DEFAULT_PROVIDER: ProviderId = 'openrouter'

export function getModel(id: string, provider: ProviderId): ModelOption | undefined {
  return MODELS.find((m) => m.id === id && m.provider === provider)
}

export function defaultModelId(provider: ProviderId): string {
  return MODELS.find((m) => m.provider === provider)!.id
}

export function isProvider(value: unknown): value is ProviderId {
  return value === 'openrouter' || value === 'claude-code'
}
