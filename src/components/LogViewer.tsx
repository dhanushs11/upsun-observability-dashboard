import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogEntry, LogsResponse } from '../types'
import { Loading } from './ui'

export default function LogViewer({
  projectId,
  env,
  service,
}: {
  projectId: string
  env: string
  service?: string
}) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [severity, setSeverity] = useState('')
  const [follow, setFollow] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      try {
        const res: LogsResponse = await fetch(
          `/api/projects/${projectId}/environments/${env}/logs?limit=200` +
            (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '') +
            (severity ? `&severity=${severity}` : ''),
        ).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        setLogs((prev) => {
          const incoming = res.data ?? []
          if (cursor) return [...(prev ?? []), ...incoming]
          return incoming
        })
        setError(null)
      } catch (e) {
        setError(String((e as Error).message))
      }
    },
    [projectId, env, severity],
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res: LogsResponse = await fetch(
          `/api/projects/${projectId}/environments/${env}/logs?limit=200` +
            (severity ? `&severity=${severity}` : ''),
        ).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        if (!cancelled) setLogs(res.data ?? [])
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [projectId, env, severity])

  useEffect(() => {
    if (!follow) return
    const id = setInterval(() => fetchLogs(), 8000)
    return () => clearInterval(id)
  }, [follow, fetchLogs])

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [logs, follow])

  const filtered = (logs ?? []).filter((l) => !service || l.service === service)

  return (
    <div>
      <div className="toolbar">
        <label>Severity:</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </select>
        <button className={follow ? 'on' : ''} onClick={() => setFollow(!follow)}>
          {follow ? '⏸ Pause follow' : '▶ Follow'}
        </button>
        <button onClick={() => fetchLogs()}>↻ Refresh</button>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {filtered.length} lines{service ? ` · service=${service}` : ''}
        </span>
      </div>
      {error && <ErrorBox message={error} />}
      {logs === null ? (
        <Loading label="Fetching logs…" />
      ) : (
        <div className="log-viewer" ref={boxRef}>
          {filtered.map((l) => (
            <div key={l.cursor} className={`log-line sev-${l.severity}`}>
              <span className="ts">{new Date(l.datetime).toLocaleTimeString()}</span>
              <span className="sev">{l.severity.padEnd(7)}</span>
              <span className="svc">[{l.service}{l.instance ? `.${l.instance.split('.').pop()}` : ''}]</span>
              <span>{l.content}</span>
            </div>
          ))}
          {!filtered.length && <div className="empty">No log entries in the retention window.</div>}
        </div>
      )}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>
}
