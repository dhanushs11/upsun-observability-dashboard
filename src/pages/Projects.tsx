import { useSelection } from '../App'
import { StatusChip, age } from '../components/ui'

export default function Projects() {
  const { projects } = useSelection()
  return (
    <div>
      <h2 className="page-title">Projects (namespaces)</h2>
      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Title</th>
              <th>ID</th>
              <th>Region</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Default branch</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td className="mono">{p.id}</td>
                <td>{p.region}</td>
                <td>{p.plan}</td>
                <td>
                  <StatusChip state={p.status === 'active' ? 'Running' : 'Inactive'} />
                </td>
                <td className="mono">{p.defaultBranch}</td>
                <td>{age(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
