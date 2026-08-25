import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Loading, ErrorBox, age } from '../components/ui'

interface OverviewData {
  totalProjects: number
  activeProjects: number
  totalEnvironments: number
  running: number
  paused: number
  recent: Array<{
    project: string
    projectId: string
    env: string
    status: string
    type: string
    lastDeploy?: string
  }>
}

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .overview()
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <h2 className="page-title">Cluster overview — organization</h2>
      {error && <ErrorBox message={error} />}
      {!data && !error && <Loading label="Loading cluster stats…" />}
      {data && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">Projects</div>
              <div className="value">{data.totalProjects}</div>
            </div>
            <div className="card">
              <div className="label">Active projects</div>
              <div className="value">{data.activeProjects}</div>
            </div>
            <div className="card">
              <div className="label">Environments</div>
              <div className="value">{data.totalEnvironments}</div>
            </div>
            <div className="card">
              <div className="label">Running environments</div>
              <div className="value" style={{ color: 'var(--success)' }}>
                {data.running}
              </div>
            </div>
            <div className="card">
              <div className="label">Paused environments</div>
              <div className="value">{data.paused}</div>
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
                {data.recent.map((e) => (
                  <tr key={`${e.projectId}-${e.env}`} className="clickable">
                    <td>{e.project}</td>
                    <td>
                      <Link to="/workloads">{e.env}</Link>
                    </td>
                    <td>{e.type}</td>
                    <td>{e.status === 'active' ? <span className="chip Running">Running</span> : <span className="chip Paused">Paused</span>}</td>
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
