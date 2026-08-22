import { useEffect, useState } from 'react'
import { useSelection } from '../App'
import { api } from '../api'
import type { NormalizedDeployment } from '../types'
import { Loading, ErrorBox, fmtBytes } from '../components/ui'

export default function ServicesRoutes() {
  const { project, env } = useSelection()
  const [data, setData] = useState<NormalizedDeployment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project || !env) return
    api
      .deployment(project, env)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [project, env])

  if (!project || !env) return <Loading label="Select a project and environment…" />
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  return (
    <div>
      <h2 className="page-title">Services &amp; Routes — {env}</h2>
      <div className="panel">
        <div className="panel-title">Services</div>
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Type</th><th className="num">Disk</th></tr>
          </thead>
          <tbody>
            {data.services.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td className="num">{fmtBytes((s.diskMiB ?? 0) * 1024 * 1024)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.services.length && <div className="empty">No services.</div>}
      </div>

      <div className="panel">
        <div className="panel-title">Routes (ingress)</div>
        <table className="data">
          <thead>
            <tr><th>URL</th><th>Type</th><th>Upstream / Target</th><th>Primary</th></tr>
          </thead>
          <tbody>
            {data.routes.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                </td>
                <td>{r.type}</td>
                <td className="mono">{r.upstream ?? '—'}</td>
                <td>{r.primary ? '★' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.routes.length && <div className="empty">No routes.</div>}
      </div>
    </div>
  )
}
