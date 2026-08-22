import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelection } from '../App'
import { api } from '../api'
import type { NormalizedDeployment } from '../types'
import { Loading, ErrorBox, StatusChip, fmtBytes } from '../components/ui'

type Tab = 'webapp' | 'worker' | 'cron' | 'pod'

export default function Workloads() {
  const { project, env } = useSelection()
  const [state, setState] = useState<{ key: string; data: NormalizedDeployment | null }>({
    key: '',
    data: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('webapp')
  const navigate = useNavigate()
  const key = `${project}/${env}`

  useEffect(() => {
    if (!project || !env) return
    api
      .deployment(project, env)
      .then((data) => setState({ key, data }))
      .catch((e) => setError(e.message))
  }, [project, env, key])

  if (!project || !env) return <Loading label="Select a project and environment…" />
  if (error) return <ErrorBox message={error} />
  if (state.key !== key || !state.data) return <Loading label="Loading workloads…" />

  const data = state.data

  const crons = data.workloads.flatMap((w) =>
    w.crons.map((c) => ({ ...c, workload: w.name })),
  )

  return (
    <div>
      <h2 className="page-title">Workloads — {env}</h2>
      <div className="tabs">
        <button className={tab === 'webapp' ? 'active' : ''} onClick={() => setTab('webapp')}>
          Applications ({data.workloads.filter((w) => w.kind === 'webapp').length})
        </button>
        <button className={tab === 'worker' ? 'active' : ''} onClick={() => setTab('worker')}>
          Workers ({data.workloads.filter((w) => w.kind === 'worker').length})
        </button>
        <button className={tab === 'cron' ? 'active' : ''} onClick={() => setTab('cron')}>
          Cron Jobs ({crons.length})
        </button>
        <button className={tab === 'pod' ? 'active' : ''} onClick={() => setTab('pod')}>
          Pods / Instances ({data.pods.length})
        </button>
      </div>

      {(tab === 'webapp' || tab === 'worker') && (
        <div className="panel">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Runtime</th>
                <th>Size</th>
                <th className="num">Disk</th>
                <th>Relationships</th>
                <th>Crons</th>
              </tr>
            </thead>
            <tbody>
              {data.workloads
                .filter((w) => w.kind === tab)
                .map((w) => (
                  <tr key={w.name} className="clickable" onClick={() => navigate(`/workloads/${w.name}`)}>
                    <td>
                      <Link to={`/workloads/${w.name}`}>{w.name}</Link>
                    </td>
                    <td>{w.runtime}</td>
                    <td>{w.size}</td>
                    <td className="num">{fmtBytes((w.diskMiB ?? 0) * 1024 * 1024)}</td>
                    <td>{w.relationships.join(', ') || '—'}</td>
                    <td>{w.crons.length || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.workloads.some((w) => w.kind === tab) && (
            <div className="empty">No {tab === 'webapp' ? 'applications' : 'workers'} in this environment.</div>
          )}
        </div>
      )}

      {tab === 'cron' && (
        <div className="panel">
          <table className="data">
            <thead>
              <tr>
                <th>Cron Job</th>
                <th>Workload</th>
                <th>Schedule</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {crons.map((c) => (
                <tr key={`${c.workload}.${c.name}`}>
                  <td>{c.name}</td>
                  <td>
                    <Link to={`/workloads/${c.workload}`}>{c.workload}</Link>
                  </td>
                  <td className="mono">{c.spec}</td>
                  <td className="mono">{c.command}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!crons.length && <div className="empty">No cron jobs configured.</div>}
        </div>
      )}

      {tab === 'pod' && (
        <div className="panel">
          <table className="data">
            <thead>
              <tr>
                <th>Instance (pod)</th>
                <th>Service</th>
                <th>#</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.pods.map((p) => (
                <tr key={p.name}>
                  <td className="mono">{p.name}</td>
                  <td>{p.service}</td>
                  <td className="num">{p.instance}</td>
                  <td>
                    <StatusChip state="Running" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.pods.length && (
            <div className="empty">
              No live instances reported. Environment may be paused or metrics unavailable.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
