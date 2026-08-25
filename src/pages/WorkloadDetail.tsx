import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSelection } from '../App'
import { api } from '../api'
import type { SeriesResponse, Workload } from '../types'
import { Loading, ErrorBox, fmtBytes } from '../components/ui'
import { Gauge, MetricChart } from '../components/charts'

const LogViewer = lazy(() => import('../components/LogViewer'))
const TerminalPane = lazy(() => import('../components/Terminal'))

function useDeploymentWorkload(
  name: string,
): { w: Workload | null; error: string | null; loading: boolean } {
  const { project, env } = useSelection()
  const [state, setState] = useState<{ key: string; w: Workload | null; error: string | null }>({
    key: '',
    w: null,
    error: null,
  })
  const key = `${project}/${env}/${name}`
  useEffect(() => {
    api
      .deployment(project, env)
      .then((d) =>
        setState({
          key,
          w: d.workloads.find((x) => x.name === name) ?? null,
          error: null,
        }),
      )
      .catch((e) => setState({ key, w: null, error: e.message }))
  }, [project, env, name, key])
  return { w: state.key === key ? state.w : null, error: state.error, loading: state.key !== key }
}

export default function WorkloadDetail() {
  const { name = '' } = useParams()
  const { project, env } = useSelection()
  const [tab, setTab] = useState<'overview' | 'metrics' | 'logs' | 'terminal'>('overview')
  const { w, error, loading } = useDeploymentWorkload(name)

  if (!project || !env) return <Loading label="Select a project and environment…" />
  if (loading) return <Loading label={`Loading ${name}…`} />
  if (error) return <ErrorBox message={error} />

  return (
    <div>
      <div className="detail-header">
        <h2>{name}</h2>
        {w && <span className="chip INFO">{w.kind}</span>}
        {w && <span className="chip Running">{w.runtime}</span>}
      </div>
      <div className="meta-row">
        <span>Environment: {env}</span>
        <span>Project: {project}</span>
      </div>
      {!w ? (
        <>
          <ErrorBox
            message={`Workload "${name}" does not exist in ${env}. You may have switched project or environment while viewing a detail page.`}
          />
          <p>
            <Link to="/workloads">← Back to workloads</Link>
          </p>
        </>
      ) : (
        <>
          <div className="tabs">
            <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
            <button className={tab === 'metrics' ? 'active' : ''} onClick={() => setTab('metrics')}>Metrics</button>
            <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Logs</button>
            <button className={tab === 'terminal' ? 'active' : ''} onClick={() => setTab('terminal')}>Terminal (exec)</button>
          </div>
          {tab === 'overview' && <OverviewTab w={w} />}
          {tab === 'metrics' && <MetricsTab name={name} />}
          {tab === 'logs' && <LogsTab name={name} />}
          {tab === 'terminal' && <TerminalTab name={name} kind={w.kind} />}
        </>
      )}
    </div>
  )
}

function OverviewTab({ w }: { w: Workload }) {
  const { project, env } = useSelection()
  const name = w.name
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.summary>> | null>(null)

  useEffect(() => {
    if (!project || !env) return
    api.summary(project, env, 3600).then(setSummary).catch(() => {})
  }, [project, env])

  const svcBlock = summary?.data?.services?.[name] ?? {}
  const firstInstance = Object.values(svcBlock)[0]

  return (
    <>
      <div className="panel">
        <div className="panel-title">Configuration</div>
        <table className="data">
          <tbody>
            <tr><td style={{ width: 180, color: 'var(--muted)' }}>Kind</td><td>{w.kind}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Runtime</td><td>{w.runtime}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Size</td><td>{w.size}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Disk</td><td>{fmtBytes((w.diskMiB ?? 0) * 1024 * 1024)}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Relationships</td><td>{w.relationships.join(', ') || '—'}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Mounts</td><td>{w.mounts.join(', ') || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      {w.crons.length > 0 && (
        <div className="panel">
          <div className="panel-title">Cron jobs</div>
          <table className="data">
            <thead><tr><th>Name</th><th>Schedule</th><th>Command</th></tr></thead>
            <tbody>
              {w.crons.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="mono">{c.spec}</td>
                  <td className="mono">{c.command}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Resource usage — last hour</h3>
      {firstInstance ? (
        <div className="gauges">
          <Gauge
            title="CPU (avg)"
            used={firstInstance['cpu_used']?.avg ?? null}
            limit={firstInstance['cpu_limit']?.max ?? null}
            format={(v) => `${v.toFixed(2)} cores`}
          />
          <Gauge
            title="Memory (avg)"
            used={firstInstance['memory_used']?.avg ?? null}
            limit={firstInstance['memory_limit']?.max ?? null}
            format={(v) => fmtBytes(v)}
          />
          <Gauge
            title="CPU peak"
            used={firstInstance['cpu_used']?.max ?? null}
            limit={firstInstance['cpu_limit']?.max ?? null}
            format={(v) => `${v.toFixed(2)} cores`}
          />
          <Gauge
            title="Memory peak"
            used={firstInstance['memory_used']?.max ?? null}
            limit={firstInstance['memory_limit']?.max ?? null}
            format={(v) => fmtBytes(v)}
          />
        </div>
      ) : (
        <div className="empty">No live metrics for this service (paused or no data).</div>
      )}
    </>
  )
}

function MetricsTab({ name }: { name: string }) {
  const { project, env } = useSelection()
  const [rangeSec, setRangeSec] = useState(3600)
  const [series, setSeries] = useState<SeriesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .serviceSeries(project, env, name, rangeSec)
      .then(setSeries)
      .catch((e) => setError(e.message))
  }, [project, env, name, rangeSec])

  const rows = useMemo(() => {
    const out: Array<Record<string, number>> = []
    for (const point of series?.data ?? []) {
      const row: Record<string, number> = { t: point.timestamp }
      let cpu = 0
      let mem = 0
      let hasCpu = false
      let hasMem = false
      for (const inst of Object.values(point.instances ?? {})) {
        cpu += inst['cpu_used']?.avg ?? 0
        mem += inst['memory_used']?.avg ?? 0
        if (inst['cpu_used']?.avg != null) hasCpu = true
        if (inst['memory_used']?.avg != null) hasMem = true
      }
      if (hasCpu) row.cpu = Number(cpu.toFixed(3))
      if (hasMem) row.mem = Math.round(mem / (1024 * 1024))
      out.push(row)
    }
    return out
  }, [series])

  if (series === null) return <Loading label="Loading time series…" />
  if (error) return <ErrorBox message={error} />

  return (
    <>
      <div className="toolbar">
        <label>Range:</label>
        {[900, 3600, 14400].map((r) => (
          <button key={r} className={rangeSec === r ? 'on' : ''} onClick={() => setRangeSec(r)}>
            {r / 60} min
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="panel-title">CPU cores used (sum across instances)</div>
        <div className="panel-body" style={{ padding: 12 }}>
          {rows.some((r) => r.cpu != null) ? (
            <MetricChart
              data={rows}
              series={[{ key: 'cpu', label: 'CPU (cores)', color: '#326ce5' }]}
              unit=""
            />
          ) : (
            <div className="empty">No CPU data available.</div>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">Memory used MiB (sum across instances)</div>
        <div className="panel-body" style={{ padding: 12 }}>
          {rows.some((r) => r.mem != null) ? (
            <MetricChart
              data={rows}
              series={[{ key: 'mem', label: 'Memory (MiB)', color: '#7b1fa2' }]}
            />
          ) : (
            <div className="empty">No memory data available.</div>
          )}
        </div>
      </div>
    </>
  )
}

function LogsTab({ name }: { name: string }) {
  const { project, env } = useSelection()
  return (
    <Suspense fallback={<Loading />}>
      <LogViewer projectId={project} env={env} service={name} />
    </Suspense>
  )
}

function TerminalTab({ name, kind }: { name: string; kind: 'webapp' | 'worker' }) {
  const { project, env, envs } = useSelection()
  const envStatus = envs.find((e) => e.id === env)?.status
  return (
    <Suspense fallback={<Loading />}>
      <TerminalPane projectId={project} env={env} app={name} kind={kind} envStatus={envStatus} />
    </Suspense>
  )
}
