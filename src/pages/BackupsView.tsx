import { useEffect, useState } from 'react'
import { useSelection } from '../App'
import { api } from '../api'
import type { Backup } from '../types'
import { Loading, ErrorBox, fmtBytes, age } from '../components/ui'

export default function BackupsView() {
  const { project, env } = useSelection()
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project || !env) return
    api
      .backups(project, env)
      .then(({ backups }) => setBackups(backups))
      .catch((e) => setError(e.message))
  }, [project, env])

  if (!project || !env) return <Loading label="Select a project and environment…" />
  if (error) return <ErrorBox message={error} />
  if (!backups) return <Loading />

  return (
    <div>
      <h2 className="page-title">Backups (volume snapshots) — {env}</h2>
      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Created</th>
              <th>Automated</th>
              <th>Restorable</th>
              <th className="num">Size</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.name ?? b.id}</td>
                <td title={b.created_at}>{age(b.created_at)} ago</td>
                <td>{b.automated ? 'yes' : 'no'}</td>
                <td>{b.restorable ? '✓' : '—'}</td>
                <td className="num">{fmtBytes(b.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!backups.length && <div className="empty">No backups found.</div>}
      </div>
    </div>
  )
}
