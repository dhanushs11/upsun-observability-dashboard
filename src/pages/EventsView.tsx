import { useEffect, useState } from 'react'
import { useSelection } from '../App'
import { api } from '../api'
import type { Activity } from '../types'
import { Loading, ErrorBox, StatusChip, age } from '../components/ui'

export default function EventsView() {
  const { project, env } = useSelection()
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project || !env) return
    api
      .activities(project, env)
      .then(({ activities }) => setActivities(activities))
      .catch((e) => setError(e.message))
  }, [project, env])

  if (!project || !env) return <Loading label="Select a project and environment…" />
  if (error) return <ErrorBox message={error} />
  if (!activities) return <Loading />

  return (
    <div>
      <h2 className="page-title">Events / Activities — {env}</h2>
      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>State</th>
              <th>Result</th>
              <th>Created</th>
              <th className="num">Duration</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.type}</td>
                <td>{a.description ?? '—'}</td>
                <td>
                  <StatusChip state={a.state === 'complete' ? 'Running' : a.state === 'in_progress' ? 'Pending' : a.state === 'failure' ? 'Failed' : 'Paused'} />
                </td>
                <td>{a.result ?? '—'}</td>
                <td title={a.created_at}>{age(a.created_at)} ago</td>
                <td className="num">{a.duration ? `${Math.round(a.duration)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!activities.length && <div className="empty">No activities recorded.</div>}
      </div>
    </div>
  )
}
