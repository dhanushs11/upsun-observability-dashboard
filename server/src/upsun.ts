import { spawn } from 'node:child_process'

const API_BASE = process.env.UPSUN_API_URL ?? 'https://api.upsun.com'
const TOKEN = process.env.UPSUN_API_TOKEN ?? process.env.PLATFORMSH_CLI_TOKEN ?? ''

export type Json = Record<string, unknown>

export class UpsunApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function viaCli(path: string): Promise<Json> {
  return new Promise((resolve, reject) => {
    const proc = spawn('platform', ['api:curl', '--no-interaction', path], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (err += d.toString()))
    proc.on('error', (e) => reject(new UpsunApiError(500, `platform CLI not available: ${e.message}`)))
    proc.on('close', (code) => {
      if (code !== 0 && !out.trim()) {
        reject(new UpsunApiError(500, `platform CLI exited ${code}: ${err.trim().slice(0, 400)}`))
        return
      }
      try {
        resolve(JSON.parse(out) as Json)
      } catch {
        reject(new UpsunApiError(502, `Unparseable CLI response for ${path}`))
      }
    })
  })
}

export async function upsunGet(path: string): Promise<Json> {
  const clean = path.replace(/^\//, '')
  if (TOKEN) {
    const res = await fetch(`${API_BASE}/${clean}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
      },
    })
    const text = await res.text()
    let body: Json
    try {
      body = JSON.parse(text) as Json
    } catch {
      throw new UpsunApiError(res.status, `Non-JSON response (${res.status}) for ${clean}`)
    }
    if (!res.ok) {
      const msg =
        typeof body['message'] === 'string' ? (body['message'] as string) : `HTTP ${res.status}`
      throw new UpsunApiError(res.status, msg)
    }
    return body
  }
  return viaCli(clean)
}

/**
 * Hydra-style list responses wrap items in a single array property
 * (e.g. { environments: [...], count }). Bare JSON arrays pass through.
 */
export function unwrapList(body: Json | Json[]): Json[] {
  if (Array.isArray(body)) return body
  for (const value of Object.values(body)) {
    if (Array.isArray(value)) return value as Json[]
  }
  return []
}
