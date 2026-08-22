# Upsun Observability Dashboard

A Kubernetes-Dashboard-style web UI for **Upsun** projects: browse projects and
environments like namespaces and workloads, watch live resource metrics, read
container logs, and open a shell (exec) into any app container.

## Feature mapping — Kubernetes Dashboard ➜ Upsun

| Kubernetes Dashboard | This dashboard (Upsun) |
| --- | --- |
| Cluster | Upsun organization |
| Namespace selector | Project selector |
| Workloads context | Environment (`main`, `staging`, PR branches) |
| Deployment | Webapp / Worker |
| Pod | Service instance (`blog.0`, `cache.0`, …) |
| CronJob | App cron definitions |
| Service | MariaDB / Redis / … services + relationships |
| Ingress | Routes (upstream / redirect) |
| ConfigMap / Secret | Variables |
| PV / PVC | Mounts & service disks |
| Events | Activities (deploys, syncs, crons) |
| Volume snapshots | Backups |
| TLS secrets / cert-manager | Certificates & domains |
| Node/pod CPU & memory graphs | `observability/resources/*` time series |
| Logs viewer | `observability/logs/query` with follow mode |
| `kubectl exec` | SSH shell via `platform ssh` over WebSocket |

## Architecture

```
Browser ── React SPA (Vite build)
   │  /api/*        REST proxy  ──►  Express ──►  api.upsun.com
   │  /ws/exec      WebSocket   ──►  Express ──►  `platform ssh -p … -e … -A …`
```

- The backend holds credentials server-side; the browser never sees tokens.
- Auth modes (auto-detected):
  1. `UPSUN_API_TOKEN` env var → direct REST calls to `api.upsun.com`
  2. otherwise → shells out to an authenticated `platform api:curl` CLI

## Quick start (Docker — recommended)

```bash
cp .env.example .env
# Edit .env: paste an Upsun API token
#   Account Settings → API Tokens → Create token

docker compose up --build -d
open http://localhost:8080
```

The compose file mounts `~/.platformsh` into the container so that the
exec/terminal feature can generate SSH certificates from your token.

## Local development

Requires Node 20+ and a logged-in Upsun CLI (`platform login`) *or* a token in
`.env`:

```bash
npm install
npm run dev          # vite on :5173 + API server on :8787
```

Production-style local run:

```bash
npm run build && npm start   # serves SPA + API on :8787
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `UPSUN_API_TOKEN` | Upsun API token (REST). Optional locally; required in Docker unless CLI session mounted. |
| `PLATFORMSH_CLI_TOKEN` | Same token, consumed by the CLI for SSH cert generation. Set automatically by compose. |
| `PORT` | Server port (default `8787`, compose uses `8080`). |
| `DIST_DIR` | Static frontend dir (set in image). |

## Checks

```bash
npm run check        # typecheck + lint + unit tests + production build
```

CI-runnable individually:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Security notes

- Read-only dashboard: no write/destructive operations are exposed.
- The terminal gives shell access equivalent to `platform ssh` for your user.
- Keep `.env` out of version control (already gitignored).

## Known limits

- The logs API enforces a minimum page size of ~100 entries.
- Metrics are unavailable for paused/inactive environments (Upsun retention:
  resources 30 days, logs 14 days, HTTP traffic 24 h).
