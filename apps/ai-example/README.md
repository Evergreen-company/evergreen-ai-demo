# ai-example

Node.js API with full observability stack: Prometheus, Loki, Tempo, Grafana, Alloy — and Cursor AI agents for monitoring and code improvement suggestions.

> **Linux / macOS only.** Alloy mounts the Docker socket (`/var/run/docker.sock`) to scrape container logs. This does not work on Windows without WSL2.

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [Docker](https://docs.docker.com/get-docker/) + Compose plugin | Run all services | [docs.docker.com](https://docs.docker.com/get-docker/) |
| [uv](https://astral.sh/uv) | Run `mcp-grafana` via `uvx` (Cursor MCP) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

Docker Compose is included with Docker Desktop. On Linux, install the [Compose plugin](https://docs.docker.com/compose/install/linux/) separately if needed.

## Start

```bash
cp .env.example .env
docker compose up -d
```

Wait ~15 seconds for services to be healthy.

| Service    | URL                    | Credentials   |
|------------|------------------------|---------------|
| Grafana    | http://localhost:3000  | admin / admin |
| App API    | http://localhost:3001  |               |
| Prometheus | http://localhost:9090  |               |
| Alloy UI   | http://localhost:12345 |               |

## Grafana MCP (Cursor)

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "grafana": {
      "command": "uvx",
      "args": ["mcp-grafana"],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_USERNAME": "admin",
        "GRAFANA_PASSWORD": "admin"
      }
    }
  }
}
```

## Load Test

k6 starts automatically with `docker compose up -d` and runs continuously (20-minute cycles, auto-restart).

To run a one-off test manually:

```bash
docker compose run --rm k6 run /scripts/script.js
```

## Stop

```bash
docker compose down          # stop services
docker compose down -v       # stop + wipe all data volumes
```
