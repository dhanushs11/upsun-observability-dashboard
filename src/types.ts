export interface Organization {
  id: string
  name: string
  label?: string
}

export interface Project {
  id: string
  organizationId: string
  title: string
  region: string
  plan: string
  status: string
  type: string
  defaultBranch: string
  createdAt: string
  projectUi: string
}

export interface Environment {
  id: string
  title: string
  type: string
  status: string
  isMain: boolean
  isPr: boolean
  parent: string | null
  headCommit: string
  machineName: string
  deploymentState: {
    lastDeploymentSuccessful?: boolean
    lastDeploymentAt?: string
    crons?: { enabled?: boolean; status?: string }
  } | null
  sizing?: {
    services?: Record<string, unknown>
    webapps?: Record<string, unknown>
    workers?: Record<string, unknown>
  }
}

export interface CronJob {
  name: string
  spec: string
  command: string
}

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

export interface Agg {
  min?: number | null
  max?: number | null
  avg?: number | null
  p50?: number | null
  p95?: number | null
  p99?: number | null
}

export interface InstanceMetrics {
  [metric: string]: Agg | undefined
}

export interface SummaryResponse {
  data?: {
    services?: Record<string, Record<string, InstanceMetrics>>
  }
}

export interface SeriesPoint {
  timestamp: number
  instances: Record<string, InstanceMetrics> | undefined
}

export interface SeriesResponse {
  _grain?: number
  data?: SeriesPoint[]
}

export interface LogEntry {
  cursor: string
  datetime: string
  severity: string
  service: string
  unit?: string
  instance?: string
  log_kind?: string
  content: string
  container_image?: string
}

export interface LogsResponse {
  data?: LogEntry[]
  _cursor?: string
  _has_more_results?: boolean
}

export interface Activity {
  id: string
  type: string
  state: string
  created_at?: string
  completion_at?: string
  description?: string
  duration?: number
  result?: string
}

export interface Backup {
  id: string
  created_at?: string
  name?: string
  automated?: boolean
  restorable?: boolean
  size?: number
}
