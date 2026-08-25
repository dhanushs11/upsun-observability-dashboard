import { Router, type Request, type Response } from 'express'
import { UpsunApiError, unwrapList, upsunGet, type Json } from './upsun.js'
import { attachPods, normalizeDeployment } from './normalize.js'
import { cached, invalidate, pooled } from './cache.js'

export const api = Router()

// Cache TTLs (ms) — observability data is minute-grain, so short caching
// removes nearly all upstream latency without showing stale data.
const TTL = {
  projects: 10 * 60_000,
  environments: 5 * 60_000,
  deployment: 2 * 60_000,
  summary: 2 * 60_000,
  activities: 60_000,
  backups: 5 * 60_000,
  certificates: 10 * 60_000,
  domains: 10 * 60_000,
  overview: 60_000,
}

function guard(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      res.json(await handler(req))
    } catch (err) {
      if (err instanceof UpsunApiError) {
        res.status(err.status).json({ error: err.message })
      } else {
        console.error(err)
        res.status(502).json({ error: 'Upstream request failed' })
      }
    }
  }
}

api.get(
  '/projects',
  guard(async () =>
    cached('projects', TTL.projects, async () => {
      const me = await upsunGet('me')
      const userId = str(me['id'], '')
      const orgsBody = await upsunGet(`users/${userId}/organizations`)
      const orgs = unwrapList(orgsBody)
      const orgLists = await pooled(orgs, 4, (org) =>
        upsunGet(`organizations/${str(org['id'])}/projects?page_size=100`).catch(() => ({}) as Json),
      )
      const projects = orgLists.flatMap((body) => unwrapList(body as Json))
      return { organizations: orgs, projects }
    }),
  ),
)

interface EnvSummary {
  project: string
  projectId: string
  env: string
  status: string
  type: string
  lastDeploy?: string
}

api.get(
  '/overview',
  guard(async () =>
    cached('overview', TTL.overview, async () => {
    const { projects } = (await cached('projects', TTL.projects, async () => {
      const me = await upsunGet('me')
      const userId = str(me['id'], '')
      const orgsBody = await upsunGet(`users/${userId}/organizations`)
      const orgs = unwrapList(orgsBody)
      const orgLists = await pooled(orgs, 4, (org) =>
        upsunGet(`organizations/${str(org['id'])}/projects?page_size=100`).catch(() => ({}) as Json),
      )
      return { organizations: orgs, projects: orgLists.flatMap((b) => unwrapList(b as Json)) }
    })) as { projects: Json[] }

    const perProject = await pooled(projects, 6, (p) =>
      // NB: distinct cache key — must NOT collide with the /environments
      // route's `envs:` key, which stores a different shape ({environments}).
      cached(`envsummary:${str(p['id'])}`, TTL.environments, async () => {
        const body = await upsunGet(`projects/${str(p['id'])}/environments`)
        const list = Array.isArray(body) ? body : (body['environments'] as Json[]) ?? []
        const envs: EnvSummary[] = list.map((e) => ({
          project: str(p['title']),
          projectId: str(p['id']),
          env: str(e['id']),
          status: str(e['status']),
          type: str(e['type']),
          lastDeploy:
            ((e['deployment_state'] as Record<string, unknown> | null)?.[
              'last_deployment_at'
            ] as string | undefined) ?? undefined,
        }))
        return envs
      }).catch(() => [] as EnvSummary[]),
    )

    const all = perProject.flat()
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p['status'] === 'active').length,
      totalEnvironments: all.length,
      running: all.filter((e) => e.status === 'active').length,
      paused: all.filter((e) => e.status === 'paused').length,
      recent: all
        .sort(
          (a, b) =>
            new Date(b.lastDeploy ?? 0).getTime() - new Date(a.lastDeploy ?? 0).getTime(),
        )
        .slice(0, 8),
    }
    })
  )
)

api.get(
  '/projects/:projectId/environments',
  guard(async (req) =>
    cached(`envs:${req.params.projectId}`, TTL.environments, async () => {
      const body = await upsunGet(`projects/${req.params.projectId}/environments`)
      const list = Array.isArray(body) ? body : body['environments']
      return { environments: Array.isArray(list) ? list : [] }
    }),
  ),
)

api.get(
  '/projects/:projectId/environments/:env/deployment',
  guard(async (req) => {
    const raw = await cached(`dep:${req.params.projectId}:${req.params.env}`, TTL.deployment, () =>
      upsunGet(
        `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/deployments/current`,
      ),
    )
    return normalizeDeployment(raw)
  }),
)

api.get(
  '/projects/:projectId/environments/:env/pods',
  guard(async (req) => {
    const { projectId, env } = req.params
    const to = Math.floor(Date.now() / 1000)
    const from = to - 3600
    const [raw, summary] = await Promise.all([
      cached(`dep:${projectId}:${env}`, TTL.deployment, () =>
        upsunGet(`projects/${projectId}/environments/${encodeURIComponent(env)}/deployments/current`),
      ),
      cached(`sum:${projectId}:${env}`, TTL.summary, () =>
        upsunGet(
          `projects/${projectId}/environments/${encodeURIComponent(env)}/observability/resources/summary?from=${from}&to=${to}&aggs[]=avg&aggs[]=max&types[]=cpu&types[]=memory`,
        ),
      ),
    ])
    return attachPods(normalizeDeployment(raw), summary)
  }),
)

api.get(
  '/projects/:projectId/environments/:env/metrics/summary',
  guard(async (req) => {
    const now = Math.floor(Date.now() / 1000)
    const to = Number(req.query.to ?? now)
    const from = Number(req.query.from ?? to - 3600)
    const aggs = String(req.query.aggs ?? 'avg,max')
    const types = String(req.query.types ?? 'cpu,memory,disk,inodes')
    return cached(`sum:${req.params.projectId}:${req.params.env}`, TTL.summary, () =>
      upsunGet(
        `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/observability/resources/summary?from=${from}&to=${to}&aggs[]=${aggs.split(',').join('&aggs[]=')}&types[]=${types.split(',').join('&types[]=')}`,
      ),
    )
  }),
)

api.get(
  '/projects/:projectId/environments/:env/metrics/services/:service',
  guard(async (req) => {
    const now = Math.floor(Date.now() / 1000)
    const to = Number(req.query.to ?? now)
    const rangeSec = Number(req.query.range ?? 3600)
    const from = to - rangeSec
    const aggs = String(req.query.aggs ?? 'avg,max')
    const types = String(req.query.types ?? 'cpu,memory,disk,inodes')
    return cached(
      `svc:${req.params.projectId}:${req.params.env}:${req.params.service}:${rangeSec}`,
      TTL.summary,
      () =>
        upsunGet(
          `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/observability/resources/service/${encodeURIComponent(req.params.service)}?from=${from}&to=${to}&aggs[]=${aggs.split(',').join('&aggs[]=')}&types[]=${types.split(',').join('&types[]=')}`,
        ),
    )
  }),
)

api.get(
  '/projects/:projectId/environments/:env/logs',
  guard(async (req) => {
    const now = Math.floor(Date.now() / 1000)
    const to = Number(req.query.to ?? now)
    // Upsun log retention allows long ranges; keep 24h as a safe ceiling.
    const rangeSec = Math.min(Number(req.query.range ?? 3600), 86400)
    const from = Number(req.query.from ?? to - rangeSec)
    const limit = Math.min(Number(req.query.limit ?? 100), 500)
    const params = new URLSearchParams({
      from: String(from),
      to: String(to),
      limit: String(limit),
      order_by: String(req.query.orderBy ?? 'DESC'),
    })
    const cursor = String(req.query.cursor ?? '')
    if (cursor) params.set('cursor', cursor)
    // The API only honors array-style filters: services[], severities[], log_kinds[].
    for (const service of String(req.query.service ?? '').split(',').filter(Boolean)) {
      params.append('services[]', service)
    }
    const severity = String(req.query.severity ?? '')
    if (severity) params.append('severities[]', severity)
    return upsunGet(
      `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/observability/logs/query?${params.toString()}`,
    )
  }),
)

api.get(
  '/projects/:projectId/environments/:env/activities',
  guard(async (req) => {
    const body = await cached(`act:${req.params.projectId}:${req.params.env}`, TTL.activities, () =>
      upsunGet(
        `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/activities`,
      ),
    )
    return { activities: unwrapList(body) }
  }),
)

api.get(
  '/projects/:projectId/environments/:env/backups',
  guard(async (req) => {
    const body = await cached(`bak:${req.params.projectId}:${req.params.env}`, TTL.backups, () =>
      upsunGet(
        `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/backups`,
      ),
    )
    return { backups: unwrapList(body) }
  }),
)

api.get(
  '/projects/:projectId/certificates',
  guard(async (req) => {
    const body = await cached(`cert:${req.params.projectId}`, TTL.certificates, () =>
      upsunGet(`projects/${req.params.projectId}/certificates`),
    )
    return { certificates: unwrapList(body) }
  }),
)

api.get(
  '/projects/:projectId/domains',
  guard(async (req) => {
    const body = await cached(`dom:${req.params.projectId}`, TTL.domains, () =>
      upsunGet(`projects/${req.params.projectId}/domains`),
    )
    return { domains: unwrapList(body) }
  }),
)

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

api.post('/cache/clear', (_req, res) => {
  invalidate('')
  res.json({ ok: true })
})
