/**
 * Pure functions mapping Upsun API payloads to K8s-Dashboard-shaped
 * resources. No I/O here so everything is unit-testable.
 */
import type { Json } from './upsun.js'

export interface Workload {
  kind: 'webapp' | 'worker'
  name: string
  type: string
  runtime: string
  size: string
  diskMiB: number | null
  instanceCount: number
  crons: CronJob[]
  mounts: string[]
  relationships: string[]
}

export interface CronJob {
  name: string
  spec: string
  command: string
}

export interface ServiceInfo {
  name: string
  type: string
  diskMiB: number | null
}

export interface RouteInfo {
  id: string
  url: string
  primary: boolean
  type: string
  upstream: string | null
}

export interface Pod {
  /** e.g. "blog.0" — mirrors a K8s pod name */
  name: string
  service: string
  instance: number
}

export interface NormalizedDeployment {
  workloads: Workload[]
  services: ServiceInfo[]
  routes: RouteInfo[]
  pods: Pod[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** "php:8.3:619" -> "php:8.3"; "mariadb:10.11:214" -> "mariadb:10.11" */
export function shortType(type: string): string {
  const parts = type.split(':')
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : type
}

function normalizeWorkload(kind: 'webapp' | 'worker', name: string, raw: Record<string, unknown>): Workload {
  const cronsRaw = asRecord(raw['crons'])
  const crons: CronJob[] = Object.entries(cronsRaw).map(([cronName, v]) => {
    const c = asRecord(v)
    const commands = asRecord(c['commands'])
    return {
      name: cronName,
      spec: str(c['spec']),
      command: str(commands['start']),
    }
  })
  const mountsRaw = asRecord(raw['mounts'])
  const relationshipsRaw = asRecord(raw['relationships'])
  return {
    kind,
    name,
    type: str(raw['type']),
    runtime: shortType(str(raw['type'])),
    size: str(raw['size'], 'AUTO'),
    diskMiB: typeof raw['disk'] === 'number' ? raw['disk'] : null,
    instanceCount: 1,
    crons,
    mounts: Object.keys(mountsRaw),
    relationships: Object.keys(relationshipsRaw),
  }
}

export function normalizeDeployment(deployment: Json): NormalizedDeployment {
  const webapps = asRecord(deployment['webapps'])
  const workers = asRecord(deployment['workers'])
  const services = asRecord(deployment['services'])
  const routes = asRecord(deployment['routes'])

  const workloads: Workload[] = [
    ...Object.entries(webapps).map(([n, v]) => normalizeWorkload('webapp', n, asRecord(v))),
    ...Object.entries(workers).map(([n, v]) => normalizeWorkload('worker', n, asRecord(v))),
  ]

  const serviceList: ServiceInfo[] = Object.entries(services).map(([name, v]) => {
    const s = asRecord(v)
    return {
      name,
      type: str(s['type']),
      diskMiB: typeof s['disk'] === 'number' ? s['disk'] : null,
    }
  })

  const routeList: RouteInfo[] = Object.entries(routes).map(([id, v]) => {
    const r = asRecord(v)
    return {
      id,
      url: str(r['url']),
      primary: r['primary'] === true,
      type: str(r['type']),
      upstream:
        typeof r['upstream'] === 'string' && r['upstream'].length > 0
          ? str(r['upstream'])
          : typeof r['to'] === 'string' && (r['to'] as string).length > 0
            ? str(r['to'])
            : null,
    }
  })

  return { workloads, services: serviceList, routes: routeList, pods: [] }
}

/**
 * Attach per-instance pods to a normalized deployment using the
 * observability summary payload (data.services.<svc>.<svc.N>).
 */
export function attachPods(normalized: NormalizedDeployment, summary: Json): NormalizedDeployment {
  const data = asRecord(summary['data'])
  const servicesBlock = asRecord(data['services'])
  const pods: Pod[] = []
  for (const [service, instances] of Object.entries(servicesBlock)) {
    for (const instanceName of Object.keys(asRecord(instances))) {
      // instance names look like "blog.0", "database.1"
      const dot = instanceName.lastIndexOf('.')
      if (dot <= 0) continue
      pods.push({
        name: instanceName,
        service,
        instance: Number.parseInt(instanceName.slice(dot + 1), 10) || 0,
      })
    }
  }
  pods.sort((a, b) => a.name.localeCompare(b.name))
  return { ...normalized, pods }

}

/** Map environment status to K8s-style phase. */
export function envPhase(status: string): 'Running' | 'Paused' | 'Inactive' | 'Unknown' {
  switch (status) {
    case 'active':
      return 'Running'
    case 'paused':
      return 'Paused'
    case 'inactive':
      return 'Inactive'
    default:
      return 'Unknown'
  }
}
