import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelection } from '../App'
import { Loading, ErrorBox, StatusChip, age } from '../components/ui'

export default function Overview() {
  const { projects, loading, error } = useSelection()
  const [envStats, setEnvStats] = useState<{
    running: number
    paused: number
    failed: number
    total: number
    recent: Array<{ project: string; env: string; status: string; type: string; lastDeploy?: string }>
  } | null>(null)

  useEffect(() => {
    if (!projects.length) return
    let cancelled = false
    Promise.all(
      projects.slice(0, 25).map((p) =>
        fetch(`/api/projects/${p.id}/environments`)
          .then((r) => r.json())
          .then(({ environments }) =>
            (environments ?? []).map((e: Record<string, unknown>) => ({
              project: p.title,
              projectId: p.id,
              env: String(e['id']),
              status: String(e['status']),
              type: String(e['type']),
              lastDeploy:
                (e['deploymentState'] as Record<string, unknown> | null)?.[
                  'lastDeploymentAt'
                ] as string | undefined,
            })),
          )
          .catch(() => []),
      ),
    ).then((groups) => {
      if (cancelled) return
      const all = groups.flat()
      setEnvStats({
        running: all.filter((e) => e.status === 'active').length,
        paused: all.filter((e) => e.status === 'paused').length,
        failed: all.filter(
          (e) => e.status === 'active' && !e.lastDeploy,
        ).length,
        total: all.length,
        recent: all
          .sort(
            (a, b) =>
              new Date(b.lastDeploy ?? 0).getTime() -
              new Date(a.lastDeploy ?? 0).getTime(),
          )
          .slice(0, 8),
      })
    })
    return () => {
      cancelled = true
    }
  }, [projects])

  const activeProjects = projects.filter((p) => p.status === 'active').length

  return (
    <div>
      <h2 className="page-title">Cluster overview — organization</h2>
      {error && <ErrorBox message={error} />}
      {(loading || (!envStats && !error)) && <Loading label="Loading cluster stats…" />}
      {envStats && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">Projects</div>
              <div className="value">{projects.length}</div>
            </div>
            <div className="card">
              <div className="label">Active projects</div>
              <div className="value">{activeProjects}</div>
            </div>
            <div className="card">
              <div className="label">Environments</div>
              <div className="value">{envStats.total}</div>
            </div>
            <div className="card">
              <div className="label">Running environments</div>
              <div className="value" style={{ color: 'var(--success)' }}>
                {envStats.running}
              </div>
            </div>
            <div className="card">
              <div className="label">Paused environments</div>
              <div className="value">{envStats.paused}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Recent deployments across projects</div>
            <table className="data">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Environment</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Last deploy</th>
                </tr>
              </thead>
              <tbody>
                {envStats.recent.map((e) => (
                  <tr key={`${e.project}-${e.env}`} className="clickable">
                    <td>{e.project}</td>
                    <td>
                      <Link to="/workloads">{e.env}</Link>
                    </td>
                    <td>{e.type}</td>
                    <td>
                      <StatusChip state={e.status === 'active' ? 'Running' : 'Paused'} />
                    </td>
                    <td>{e.lastDeploy ? `${age(e.lastDeploy)} ago` : 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
