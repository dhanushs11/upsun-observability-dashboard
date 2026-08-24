import { Router, type Request, type Response } from 'express'
import { UpsunApiError, unwrapList, upsunGet, type Json } from './upsun.js'
import { attachPods, normalizeDeployment } from './normalize.js'

export const api = Router()

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
  guard(async () => {
    const me = await upsunGet('me')
    const userId = str(me['id'], '')
    const orgsBody = await upsunGet(`users/${userId}/organizations`)
    const orgs = unwrapList(orgsBody)
    const projects: Json[] = []
    for (const org of orgs) {
      const id = str(org['id'])
      if (!id) continue
      const body = await upsunGet(`organizations/${id}/projects?page_size=100`)
      projects.push(...unwrapList(body))
    }
    return { organizations: orgs, projects }
  }),
)

api.get(
  '/projects/:projectId/environments',
  guard(async (req) => {
    const body = await upsunGet(`projects/${req.params.projectId}/environments`)
    const list = Array.isArray(body) ? body : body['environments']
    return { environments: Array.isArray(list) ? list : [] }
  }),
)

api.get(
  '/projects/:projectId/environments/:env/deployment',
  guard(async (req) => {
    const raw = await upsunGet(
      `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/deployments/current`,
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
      upsunGet(`projects/${projectId}/environments/${encodeURIComponent(env)}/deployments/current`),
      upsunGet(
        `projects/${projectId}/environments/${encodeURIComponent(env)}/observability/resources/summary?from=${from}&to=${to}&aggs[]=avg&aggs[]=max&types[]=cpu&types[]=memory`,
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
    return upsunGet(
      `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/observability/resources/summary?from=${from}&to=${to}&aggs[]=${aggs.split(',').join('&aggs[]=')}&types[]=${types.split(',').join('&types[]=')}`,
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
    return upsunGet(
      `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/observability/resources/service/${encodeURIComponent(req.params.service)}?from=${from}&to=${to}&aggs[]=${aggs.split(',').join('&aggs[]=')}&types[]=${types.split(',').join('&types[]=')}`,
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
    const body = await upsunGet(
      `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/activities`,
    )
    return { activities: unwrapList(body) }
  }),
)

api.get(
  '/projects/:projectId/environments/:env/backups',
  guard(async (req) => {
    const body = await upsunGet(
      `projects/${req.params.projectId}/environments/${encodeURIComponent(req.params.env)}/backups`,
    )
    return { backups: unwrapList(body) }
  }),
)

api.get(
  '/projects/:projectId/certificates',
  guard(async (req) => {
    const body = await upsunGet(`projects/${req.params.projectId}/certificates`)
    return { certificates: unwrapList(body) }
  }),
)

api.get(
  '/projects/:projectId/domains',
  guard(async (req) => {
    const body = await upsunGet(`projects/${req.params.projectId}/domains`)
    return { domains: unwrapList(body) }
  }),
)

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
