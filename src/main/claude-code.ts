import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import {
  query,
  type Options,
  type Query,
  type SDKAssistantMessageError,
  type SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeCodeStatus, StreamError, StreamEvent } from '@shared/types'
import { buildSystemPrompt, type ReplyRequest } from './prompt'

const LOGIN_HINT = 'Run `claude` in a terminal and sign in with /login.'
const INSTALL_HINT = 'Install Claude Code (claude.com/claude-code), then sign in with /login.'

// Used when the shell lookup fails, e.g. `claude` is a shell alias rather than a file.
const KNOWN_PATHS = [
  join(homedir(), '.local/bin/claude'),
  join(homedir(), '.claude/local/claude'),
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude'
]

const SHELL_MARKER = '__replai__'

interface ClaudeInstall {
  executable: string | undefined
  path: string | undefined
}

/**
 * Generates replies through the user's local Claude Code install and its login
 * (subscription or API key), via the Claude Agent SDK. Runs as a plain one-turn
 * chat: no tools, no user settings, nothing persisted to disk.
 */
export class ClaudeCodeService {
  private install: ClaudeInstall | undefined

  /**
   * Streams a single reply with the same event contract as OpenRouterService:
   * `start`, `token`*, `done` — or a single `error`. Never throws.
   */
  async stream(params: ReplyRequest, emit: (e: StreamEvent) => void): Promise<void> {
    const { requestId, signal } = params
    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    signal.addEventListener('abort', onAbort, { once: true })

    let fullText = ''
    let started = false
    const emitText = (text: string): void => {
      if (!started) {
        started = true
        emit({ type: 'start', requestId })
      }
      fullText += text
      emit({ type: 'token', requestId, text })
    }

    let q: Query | undefined
    try {
      q = query({
        prompt: imageMessage(params),
        options: {
          ...(await this.baseOptions()),
          abortController,
          model: params.modelId,
          systemPrompt: buildSystemPrompt(params.presetId, params.intent),
          includePartialMessages: true,
          thinking: { type: 'disabled' }
        }
      })

      for await (const msg of q) {
        if (msg.type === 'stream_event') {
          const ev = msg.event
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            emitText(ev.delta.text)
          }
        } else if (msg.type === 'assistant' && msg.error) {
          emit({ type: 'error', requestId, error: classifyAssistantError(msg.error) })
          return
        } else if (msg.type === 'result') {
          if (msg.subtype !== 'success' || msg.is_error) {
            const detail = msg.subtype === 'success' ? msg.result : msg.errors.join(' ')
            emit({
              type: 'error',
              requestId,
              error: { kind: 'model', message: detail || 'Claude Code returned an error.' }
            })
            return
          }
          if (!fullText && msg.result) emitText(msg.result)
          emit({ type: 'done', requestId, fullText })
          return
        }
      }
      if (!signal.aborted) {
        emit({
          type: 'error',
          requestId,
          error: { kind: 'unknown', message: 'Claude Code stopped without a reply.' }
        })
      }
    } catch (err) {
      if (signal.aborted) return // superseded/cancelled — stay silent
      emit({ type: 'error', requestId, error: classifyThrown(err) })
    } finally {
      signal.removeEventListener('abort', onAbort)
      q?.close()
    }
  }

  /** Starts Claude Code without sending a prompt and reads which account it's signed in to. */
  async checkStatus(): Promise<ClaudeCodeStatus> {
    const abortController = new AbortController()
    let q: Query | undefined
    try {
      q = query({
        prompt: waitForAbort(abortController.signal),
        options: { ...(await this.baseOptions()), abortController }
      })
      const account = await withTimeout(q.accountInfo(), 20_000)
      if (account.email) return { ok: true, message: `Signed in as ${account.email}.` }
      if (account.apiKeySource && account.apiKeySource !== 'none') {
        return { ok: true, message: `Using API key (${account.apiKeySource}).` }
      }
      if (account.apiProvider && account.apiProvider !== 'firstParty') {
        return { ok: true, message: `Using ${account.apiProvider}.` }
      }
      return { ok: false, message: `Claude Code is installed but not signed in. ${LOGIN_HINT}` }
    } catch (err) {
      return { ok: false, message: classifyThrown(err).message }
    } finally {
      abortController.abort()
      q?.close()
    }
  }

  private async baseOptions(): Promise<Options> {
    const { executable, path } = await this.resolveInstall()
    return {
      pathToClaudeCodeExecutable: executable,
      cwd: app.getPath('temp'),
      tools: [],
      maxTurns: 1,
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: {
        ...process.env,
        PATH: path ?? process.env.PATH,
        CLAUDE_AGENT_SDK_CLIENT_APP: `replai/${app.getVersion()}`
      }
    }
  }

  /**
   * Finds the user's installed `claude` and their shell's PATH. Finder-launched apps
   * get a minimal PATH, so npm/nvm installs (Node scripts) couldn't find `node` without it.
   * Falls back to the SDK's bundled binary, which only exists in dev (packaged builds
   * exclude it — it's ~300 MB). Only a found install is cached, so installing later is picked up.
   */
  private async resolveInstall(): Promise<ClaudeInstall> {
    if (this.install) return this.install
    const shell = await readLoginShell()
    const install = {
      executable: shell.claude ?? KNOWN_PATHS.find((p) => existsSync(p)),
      path: shell.path
    }
    if (install.executable) this.install = install
    return install
  }
}

async function* imageMessage(params: ReplyRequest): AsyncGenerator<SDKUserMessage> {
  yield {
    type: 'user',
    parent_tool_use_id: null,
    message: {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: params.image.mimeType as 'image/png',
            data: params.image.imageBase64
          }
        }
      ]
    }
  }
}

// Keeps streaming-input mode open (no prompt) until the status check is done.
async function* waitForAbort(signal: AbortSignal): AsyncGenerator<SDKUserMessage> {
  await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()))
}

// Interactive (-i) so ~/.zshrc runs too: that's where nvm and most PATH edits live.
function readLoginShell(): Promise<{ claude?: string; path?: string }> {
  const shell = process.env.SHELL || '/bin/zsh'
  const script = `printf '${SHELL_MARKER}%s\\n${SHELL_MARKER}%s\\n' "$(command -v claude)" "$PATH"`
  return new Promise((resolve) => {
    execFile(shell, ['-ilc', script], { timeout: 5000 }, (_err, stdout) => {
      // Shell profiles can print banners, so only read the marked lines.
      const [claude, path] = stdout
        .split('\n')
        .filter((line) => line.startsWith(SHELL_MARKER))
        .map((line) => line.slice(SHELL_MARKER.length).trim())
      resolve({
        claude: claude && isAbsolute(claude) && existsSync(claude) ? claude : undefined,
        path: path || undefined
      })
    })
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Claude Code did not respond in time.')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function classifyAssistantError(error: SDKAssistantMessageError): StreamError {
  switch (error) {
    case 'authentication_failed':
    case 'oauth_org_not_allowed':
    case 'verification_required':
    case 'cloud_credential_error':
      return { kind: 'auth', message: `Claude Code isn't signed in. ${LOGIN_HINT}` }
    case 'account_on_hold':
    case 'billing_error':
      return { kind: 'auth', message: 'Your Claude account has a billing or access issue.' }
    case 'rate_limit':
      return { kind: 'rate_limit', message: 'Claude usage limit reached. Try again later.' }
    case 'overloaded':
    case 'server_error':
      return { kind: 'unknown', message: 'Claude is overloaded or having issues. Try again shortly.' }
    case 'model_not_found':
      return { kind: 'model', message: 'Model unavailable for this account. Try another model.' }
    default:
      return { kind: 'unknown', message: `Claude Code request failed (${error}).` }
  }
}

function classifyThrown(err: unknown): StreamError {
  const message = err instanceof Error ? err.message : String(err)
  if (/Native CLI binary|ENOENT|spawn/i.test(message)) {
    return { kind: 'auth', message: `Claude Code not found. ${INSTALL_HINT}` }
  }
  if (/network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return { kind: 'network', message: 'No network connection.' }
  }
  return { kind: 'unknown', message }
}
