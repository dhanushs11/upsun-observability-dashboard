import { useEffect, useState } from 'react'
import { useSelection } from '../App'
import { Loading, ErrorBox } from '../components/ui'

interface Certificate {
  id?: string
  expires_at?: string
  issued_on?: string
  domains?: string[]
}

interface Domain {
  id?: string
  name?: string
  created_at?: string
  ssl?: { has_certificate?: boolean }
}

export default function CertificatesView() {
  const { project } = useSelection()
  const [certs, setCerts] = useState<Certificate[] | null>(null)
  const [domains, setDomains] = useState<Domain[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project) return
    Promise.all([
      fetch(`/api/projects/${project}/certificates`).then((r) => r.json()),
      fetch(`/api/projects/${project}/domains`).then((r) => r.json()),
    ])
      .then(([c, d]) => {
        setCerts(c.certificates ?? [])
        setDomains(d.domains ?? [])
      })
      .catch((e) => setError(String((e as Error).message)))
  }, [project])

  if (!project) return <Loading label="Select a project…" />
  if (error) return <ErrorBox message={error} />
  if (!certs || !domains) return <Loading />

  return (
    <div>
      <h2 className="page-title">Certificates &amp; Domains</h2>

      <div className="panel">
        <div className="panel-title">TLS certificates</div>
        <table className="data">
          <thead>
            <tr><th>Domains</th><th>Issued</th><th>Expires</th></tr>
          </thead>
          <tbody>
            {certs.map((c, i) => (
              <tr key={c.id ?? i}>
                <td>{(c.domains ?? []).join(', ')}</td>
                <td>{c.issued_on ?? '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{c.expires_at ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!certs.length && <div className="empty">No custom certificates (platform certs in use).</div>}
      </div>

      <div className="panel">
        <div className="panel-title">Domains</div>
        <table className="data">
          <thead>
            <tr><th>Domain</th><th>Created</th><th>TLS</th></tr>
          </thead>
          <tbody>
            {domains.map((d, i) => (
              <tr key={d.id ?? i}>
                <td className="mono">{d.name}</td>
                <td>{d.created_at?.slice(0, 10) ?? '—'}</td>
                <td>{d.ssl?.has_certificate ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!domains.length && <div className="empty">No custom domains.</div>}
      </div>
    </div>
  )
}
