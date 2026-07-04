import { getPreset } from '@shared/models'

/**
 * Builds the system prompt (plan §6).
 *
 * Intent-given mode treats the typed text as a rough *gist* to be developed into
 * a full, natural message — not a phrase to echo back. The factual guardrail is
 * kept narrow (no invented commitments/facts) so it doesn't flatten tone/length.
 */
export function buildSystemPrompt(presetId: string, intent: string): string {
  const preset = getPreset(presetId)
  const style = preset ? preset.instruction : 'natural and appropriate to the conversation'
  const trimmed = intent.trim()

  const lines = [
    'You are a reply assistant helping the user respond in the chat conversation shown in the image.',
    'Messages aligned to the right are the user’s own; messages on the left are from the other person.',
    'Read the conversation, its tone, and the latest message the user is replying to.',
    `Write ONE reply for the user to send, in this style: ${style}.`
  ]

  if (trimmed) {
    lines.push(
      `The user jotted a rough note of what they want to get across: "${trimmed}".`,
      'Treat this note as the gist, not the wording. Develop it into a complete, ' +
        'natural-sounding message in the user’s voice that fits the flow of the ' +
        'conversation — add the connective phrasing and warmth a real person would use, ' +
        'and make it read like a genuine reply, not a restatement. Do NOT simply copy, ' +
        'spell-check, or lightly reword the note.',
      'Keep its meaning and don’t invent specific facts, commitments, names, dates, or ' +
        'claims the user didn’t imply — but you have full freedom over tone, phrasing, and length.'
    )
  } else {
    lines.push(
      'Infer the most natural, helpful reply to the latest message and write it as a ' +
        'complete, genuine response that moves the conversation forward.'
    )
  }

  lines.push(
    'Make the reply as long as it naturally should be for this conversation and style — a ' +
      'real, fleshed-out message rather than a clipped one-liner, unless the chosen style is brief by nature.',
    'If the image does not look like a conversation, say so briefly instead of inventing a reply.',
    'Reply with the message text only — no quotes, no preamble, no labels, no options.'
  )

  return lines.join('\n')
}
