import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { api } from './api'
import type { Environment, Project } from './types'
import Overview from './pages/Overview'
import Projects from './pages/Projects'
import Workloads from './pages/Workloads'
import WorkloadDetail from './pages/WorkloadDetail'
import ServicesRoutes from './pages/ServicesRoutes'
import EventsView from './pages/EventsView'
import BackupsView from './pages/BackupsView'
import CertificatesView from './pages/CertificatesView'

interface Selection {
  project: string
  env: string
  setProject: (id: string) => void
  setEnv: (id: string) => void
  projects: Project[]
  envs: Environment[]
  loading: boolean
  error: string | null
}

const Ctx = createContext<Selection>({
  project: '',
  env: '',
  setProject: () => {},
  setEnv: () => {},
  projects: [],
  envs: [],
  loading: false,
  error: null,
})

export const useSelection = () => useContext(Ctx)

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [envs, setEnvs] = useState<Environment[]>([])
  const [project, setProjectId] = useState(
    () => localStorage.getItem('sel.project') ?? '',
  )
  const [env, setEnvId] = useState(() => localStorage.getItem('sel.env') ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .projects()
      .then(({ projects }) => {
        setProjects(projects)
        if (!projects.some((p) => p.id === project)) {
          setProjectId(projects[0]?.id ?? '')
        }
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!project) return
    localStorage.setItem('sel.project', project)
    api
      .environments(project)
      .then(({ environments }) => {
        setEnvs(environments)
        if (!environments.some((e) => e.id === env)) {
          const preferred =
            environments.find((e) => e.status === 'active' && e.isMain) ??
            environments[0]
          setEnvId(preferred?.id ?? '')
        }
      })
      .catch((e) => setError(String(e.message)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  const setProject = (id: string) => {
    setProjectId(id)
    setEnvId('')
  }
  const setEnv = (id: string) => {
    setEnvId(id)
    localStorage.setItem('sel.env', id)
  }

  return (
    <Ctx.Provider value={{ project, env, setProject, setEnv, projects, envs, loading, error }}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">▲ Upsun Dashboard</div>
          <nav>
            <div className="section">Cluster</div>
            <NavLink to="/" end>Overview</NavLink>
            <NavLink to="/projects">Projects</NavLink>
            <div className="section">Workloads</div>
            <NavLink to="/workloads">Apps &amp; Workers</NavLink>
            <div className="section">Discovery</div>
            <NavLink to="/services">Services &amp; Routes</NavLink>
            <div className="section">Configuration</div>
            <NavLink to="/certificates">Certificates &amp; Domains</NavLink>
            <div className="section">Observability</div>
            <NavLink to="/events">Events / Activities</NavLink>
            <NavLink to="/backups">Backups</NavLink>
          </nav>
        </aside>
        <div className="main">
          <header className="topbar">
            <label>Project</label>
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              {loading && <option>Loading…</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.id})
                </option>
              ))}
            </select>
            <label>Environment</label>
            <select value={env} onChange={(e) => setEnv(e.target.value)}>
              {envs.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {e.status}
                </option>
              ))}
            </select>
            {env && (
              <button className="toolbar-btn" onClick={() => navigate('/workloads')} style={{ marginLeft: 'auto' }}>
                Open workloads →
              </button>
            )}
          </header>
          <main className="content">
            {error && <div className="error-box">{error}</div>}
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/workloads" element={<Workloads />} />
              <Route path="/workloads/:name" element={<WorkloadDetail />} />
              <Route path="/services" element={<ServicesRoutes />} />
              <Route path="/events" element={<EventsView />} />
              <Route path="/backups" element={<BackupsView />} />
              <Route path="/certificates" element={<CertificatesView />} />
            </Routes>
          </main>
        </div>
      </div>
    </Ctx.Provider>
  )
}
