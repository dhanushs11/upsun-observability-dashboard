import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogEntry, LogsResponse } from '../types'
import { Loading } from './ui'

const RANGES: Array<{ label: string; sec: number }> = [
  { label: '15 min', sec: 900 },
  { label: '1 h', sec: 3600 },
  { label: '6 h', sec: 21600 },
  { label: '24 h', sec: 86400 },
]

interface LogQuery {
  projectId: string
  env: string
  rangeSec: number
  severity: string
  service: string
}

async function loadLogs(q: LogQuery): Promise<LogEntry[]> {
  const to = Math.floor(Date.now() / 1000)
  const params = new URLSearchParams({
    range: String(q.rangeSec),
    to: String(to),
    limit: '200',
  })
  if (q.severity) params.set('severity', q.severity)
  if (q.service) params.set('service', q.service)
  const res: LogsResponse = await fetch(
    `/api/projects/${q.projectId}/environments/${q.env}/logs?${params.toString()}`,
  ).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
  return res.data ?? []
}

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
  const [rangeSec, setRangeSec] = useState(3600)
  const [allServices, setAllServices] = useState(false)
  const [follow, setFollow] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const effectiveService = allServices ? '' : (service ?? '')
  const query: LogQuery = { projectId, env, rangeSec, severity, service: effectiveService }

  useEffect(() => {
    let cancelled = false
    loadLogs(query)
      .then((data) => {
        if (!cancelled) {
          setLogs(data)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, env, rangeSec, severity, effectiveService])

  const refresh = useCallback(() => {
    loadLogs(query)
      .then(setLogs)
      .catch((e: Error) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, env, rangeSec, severity, effectiveService])

  useEffect(() => {
    if (!follow) return
    const id = setInterval(refresh, 8000)
    return () => clearInterval(id)
  }, [follow, refresh])

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [logs, follow])

  const filtered = logs ?? []

  return (
    <div>
      <div className="toolbar">
        <label>Range:</label>
        {RANGES.map((r) => (
          <button
            key={r.sec}
            className={rangeSec === r.sec ? 'on' : ''}
            onClick={() => setRangeSec(r.sec)}
          >
            {r.label}
          </button>
        ))}
        <label style={{ marginLeft: 12 }}>Severity:</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </select>
        {service && (
          <label style={{ marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={allServices}
              onChange={(e) => setAllServices(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            All services
          </label>
        )}
        <button className={follow ? 'on' : ''} onClick={() => setFollow(!follow)}>
          {follow ? '⏸ Pause follow' : '▶ Follow'}
        </button>
        <button onClick={refresh}>↻ Refresh</button>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {filtered.length} lines
          {effectiveService ? ` · service=${effectiveService}` : ' · all services'}
        </span>
      </div>
      {error && <ErrorBox message={error} />}
      {logs === null ? (
        <Loading label="Fetching logs…" />
      ) : filtered.length ? (
        <div className="log-viewer" ref={boxRef}>
          {filtered.map((l) => (
            <div key={l.cursor} className={`log-line sev-${l.severity}`}>
              <span className="ts">{new Date(l.datetime).toLocaleTimeString()}</span>
              <span className="sev">{l.severity.padEnd(7)}</span>
              <span className="svc">
                [{l.service}
                {l.instance ? `.${l.instance.split('.').pop()}` : ''}]
              </span>
              <span>{l.content}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          No log entries{effectiveService ? ` for service "${effectiveService}"` : ''} in the
          selected range.
          <br />
          <span style={{ fontSize: 12 }}>
            Try a longer range, clear severity filters, or tick “All services” — this app may
            simply not have logged recently.
          </span>
        </div>
      )}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>
}
