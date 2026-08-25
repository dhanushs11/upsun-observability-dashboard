async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)
    throw new Error(String(body['error'] ?? `HTTP ${res.status}`))
  }
  return res.json() as Promise<T>
}

import type {
  Activity,
  Backup,
  Environment,
  LogsResponse,
  NormalizedDeployment,
  Organization,
  Project,
  SeriesResponse,
  SummaryResponse,
} from './types'

export const api = {
  overview: () =>
    get<{
      totalProjects: number
      activeProjects: number
      totalEnvironments: number
      running: number
      paused: number
      recent: Array<{ project: string; projectId: string; env: string; status: string; type: string; lastDeploy?: string }>
    }>('/api/overview'),

  projects: () =>
    get<{ organizations: Organization[]; projects: Project[] }>('/api/projects'),

  environments: (projectId: string) =>
    get<{ environments: Environment[] }>(
      `/api/projects/${projectId}/environments`,
    ),

  deployment: (projectId: string, env: string) =>
    get<NormalizedDeployment>(
      `/api/projects/${projectId}/environments/${env}/deployment`,
    ),

  summary: (projectId: string, env: string, rangeSec: number) =>
    get<SummaryResponse>(
      `/api/projects/${projectId}/environments/${env}/metrics/summary?range=${rangeSec}`,
    ),

  serviceSeries: (
    projectId: string,
    env: string,
    service: string,
    rangeSec: number,
  ) =>
    get<SeriesResponse>(
      `/api/projects/${projectId}/environments/${env}/metrics/services/${encodeURIComponent(service)}?range=${rangeSec}&types[]=cpu&types[]=memory`,
    ),

  logs: (
    projectId: string,
    env: string,
    opts: { limit?: number; cursor?: string; severity?: string } = {},
  ) => {
    const params = new URLSearchParams()
    if (opts.limit) params.set('limit', String(opts.limit))
    if (opts.cursor) params.set('cursor', opts.cursor)
    if (opts.severity) params.set('severity', opts.severity)
    return get<LogsResponse>(
      `/api/projects/${projectId}/environments/${env}/logs?${params.toString()}`,
    )
  },

  activities: (projectId: string, env: string) =>
    get<{ activities: Activity[] }>(
      `/api/projects/${projectId}/environments/${env}/activities`,
    ),

  backups: (projectId: string, env: string) =>
    get<{ backups: Backup[] }>(
      `/api/projects/${projectId}/environments/${env}/backups`,
    ),
}
