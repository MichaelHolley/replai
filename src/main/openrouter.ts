import type { CaptureReadyPayload, StreamError, StreamEvent } from '@shared/types'
import { buildSystemPrompt } from './prompt'

const BASE = 'https://openrouter.ai/api/v1'
const REFERER = 'https://github.com/fipsi/fipsi'
const TITLE = 'Fipsi'

export interface StreamParams {
  apiKey: string
  modelId: string
  presetId: string
  intent: string
  image: CaptureReadyPayload
  requestId: string
  signal: AbortSignal
}

/**
 * OpenRouter client. Runs entirely in the main process so the API key never
 * reaches a renderer (plan §5, rule 5).
 */
export class OpenRouterService {
  /**
   * Cheap validation call used at settings-save time (plan Milestone 4).
   * Hits the authenticated key-info endpoint: 200 = valid, 401 = bad key.
   */
  async validateKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`${BASE}/key`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (res.ok) return { ok: true, message: 'Key is valid.' }
      if (res.status === 401) return { ok: false, message: 'Invalid API key.' }
      return { ok: false, message: `Unexpected response (${res.status}).` }
    } catch {
      return { ok: false, message: 'Could not reach OpenRouter. Check your connection.' }
    }
  }

  /**
   * Streams a single reply. Emits `start`, then `token`* , then `done` — or a
   * single `error` event. Never throws to the caller.
   */
  async stream(params: StreamParams, emit: (e: StreamEvent) => void): Promise<void> {
    const { requestId } = params
    let fullText = ''
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        signal: params.signal,
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': REFERER,
          'X-Title': TITLE
        },
        body: JSON.stringify({
          model: params.modelId,
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt(params.presetId, params.intent) },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${params.image.mimeType};base64,${params.image.imageBase64}`
                  }
                }
              ]
            }
          ]
        })
      })

      if (!res.ok || !res.body) {
        emit({ type: 'error', requestId, error: await classifyHttpError(res) })
        return
      }

      emit({ type: 'start', requestId })

      for await (const data of parseSSE(res.body)) {
        if (data === '[DONE]') break
        let json: OpenRouterChunk
        try {
          json = JSON.parse(data)
        } catch {
          continue // ignore keep-alive / malformed lines
        }
        // OpenRouter surfaces mid-stream errors in the chunk body.
        if (json.error) {
          emit({
            type: 'error',
            requestId,
            error: { kind: 'model', message: json.error.message || 'Model returned an error.' }
          })
          return
        }
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          emit({ type: 'token', requestId, text: delta })
        }
      }

      emit({ type: 'done', requestId, fullText })
    } catch (err) {
      if (params.signal.aborted) return // superseded/cancelled — stay silent
      emit({ type: 'error', requestId, error: classifyThrown(err) })
    }
  }
}

interface OpenRouterChunk {
  choices?: Array<{ delta?: { content?: string } }>
  error?: { message?: string; code?: number }
}

/** Yields the `data:` payload of each SSE event from a fetch response body. */
async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      // SSE events are separated by a blank line.
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trimEnd()
        buffer = buffer.slice(idx + 1)
        if (line.startsWith('data:')) {
          yield line.slice(5).trim()
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function classifyHttpError(res: Response): Promise<StreamError> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    /* ignore */
  }
  switch (res.status) {
    case 401:
    case 403:
      return { kind: 'auth', message: detail || 'Invalid or unauthorized API key.' }
    case 429:
      return { kind: 'rate_limit', message: detail || 'Rate limited. Try again shortly.' }
    case 402:
      return { kind: 'auth', message: detail || 'Insufficient credits on this key.' }
    case 404:
      return { kind: 'model', message: detail || 'Model unavailable. Try another model.' }
    default:
      if (res.status >= 500)
        return { kind: 'model', message: detail || 'The model provider is having issues.' }
      return { kind: 'unknown', message: detail || `Request failed (${res.status}).` }
  }
}

function classifyThrown(err: unknown): StreamError {
  const message = err instanceof Error ? err.message : String(err)
  if (/network|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|dns/i.test(message)) {
    return { kind: 'network', message: 'No network connection.' }
  }
  return { kind: 'unknown', message }
}
