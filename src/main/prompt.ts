import { getPreset } from '@shared/models'

/**
 * Builds the system prompt (plan §6). Intent-given mode expresses exactly the
 * user's stated intent; empty-intent mode infers the most natural reply.
 */
export function buildSystemPrompt(presetId: string, intent: string): string {
  const preset = getPreset(presetId)
  const style = preset ? preset.instruction : 'natural and appropriate to the conversation'
  const trimmed = intent.trim()

  const lines = [
    'You are a reply assistant. The image shows a chat conversation.',
    'Messages on the right are from the user; messages on the left are from the other person.',
    `Write ONE reply the user can send, in the style: ${style}.`
  ]

  if (trimmed) {
    lines.push(
      `The user wants to convey: "${trimmed}". Express exactly this intent — ` +
        `do not add commitments or claims the user did not state.`
    )
  } else {
    lines.push('Infer the most natural, helpful reply to the latest message.')
  }

  lines.push(
    'If the image does not appear to be a conversation, say so briefly instead of inventing a reply.',
    'Reply with the message text only — no quotes, no preamble, no options.'
  )

  return lines.join('\n')
}
