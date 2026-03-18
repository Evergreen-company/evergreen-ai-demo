---
description: "Incident — produces structured incident report from metrics, logs, traces, alerts. Output: .cursor/out/incident-*.md"
---

# Incident Agent

**Role:** Incident commander — produces a structured incident report by analyzing current signals
across metrics, logs, traces, and alerts.

Collects full system state, determines severity, identifies root cause, and outputs a complete
incident report saved to `.cursor/out/incident-<YYYY-MM-DD-HH-MM>.md`.

---

## Execution flow

### Step 1 — Verify datasources
```
list_datasources
```
Confirm: Prometheus (uid: `prometheus`), Loki (uid: `loki`), Tempo (uid: `tempo`).

### Step 2 — Firing alerts (both layers, in parallel)
```
alerting_manage_rules  operation: list  limit_alerts: 200
alerting_manage_rules  operation: list  datasource_uid: prometheus  limit_alerts: 200
```
For every rule where `state = "firing"`:
1. Record name, severity label, `for` duration, summary/description annotations.
2. Run the alert's `expr` via `query_prometheus` (instant) to confirm current value.

### Step 3 — Metrics snapshot (all `query_prometheus`, queryType: instant)
```promql
# Overall error rate
sum(rate(http_requests_total{job="api",status_code=~"5.."}[5m]))
/ sum(rate(http_requests_total{job="api"}[5m]))

# p95 latency per route
histogram_quantile(0.95,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket{job="api"}[5m])
  )
)

# RPS per route
sum by (route) (rate(http_requests_total{job="api"}[2m]))

# CPU %
rate(process_cpu_seconds_total{job="api"}[1m]) * 100

# Heap used bytes
nodejs_heap_size_used_bytes{job="api"}

# Cache hit ratio
rate(cache_hits_total{job="api"}[5m])
/ (rate(cache_hits_total{job="api"}[5m]) + rate(cache_misses_total{job="api"}[5m]))

# Active connections
active_connections{job="api"}
```

### Step 4 — Error logs (last 20 entries)
```
query_loki_logs
  datasourceUid: loki
  logql: {service="api", level="error"} | json
  limit: 20
```
From results: extract unique `traceId`; for each log line also take `time`, `endpoint` or `msg`/route (e.g. from `endpoint` label or log body). Build **top 5 traces** list (by time, newest first): traceId, route/endpoint, time (UTC), and a working Grafana Explore link.

### Step 5 — Build trace links (Grafana Explore opens trace by ID)
Do **not** use the generic Explore link with only `left=...` (it opens empty). Use **schemaVersion=1** and **panes** so the trace opens in the TraceQL view:

- Base: `http://localhost:3000` (or Grafana URL from context).
- For each traceId, build:
  - `panes = { "t1": { "datasource": "tempo", "queries": [{ "refId": "A", "datasource": { "uid": "tempo" }, "queryType": "traceql", "query": "<traceId>" }], "range": { "from": "now-1h", "to": "now" }, "compact": true } }`
  - URL = `{base}/explore?schemaVersion=1&panes={encodeURIComponent(JSON.stringify(panes))}&orgId=1`

Optional: if your Grafana uses time range in ms, set `range.from` and `range.to` to unix milliseconds (e.g. now-1h and now).

### Step 6 — Traces (optional)
For slow-request analysis:
```
find_slow_requests  datasourceUid: tempo  name: incident-investigation  labels: { "service": "api" }
```
Record: route, status, duration, span tree summary.

### Step 7 — Determine severity

| Severity | Condition |
|----------|-----------|
| P1 — Critical | Error rate > 50% OR app is unreachable OR `AppDown` alert firing |
| P2 — Major | Error rate 15–50% OR p95 > 5s on key route OR multiple alerts firing |
| P3 — Minor | Error rate 5–15% OR p95 2–5s OR single non-critical alert firing |
| P4 — Low | All SLOs met, alerts informational only |

### Step 8 — Write report

Create `.cursor/out/` directory if it does not exist, then write the report using the
template below to `.cursor/out/incident-<YYYY-MM-DD-HH-MM>.md` (use current UTC time).

---

## Report template

```markdown
# Incident Report — <YYYY-MM-DD HH:MM UTC>

**Severity:** P1 / P2 / P3 / P4
**Status:** Ongoing / Resolved
**Service:** api (env: demo)
**Detected at:** <timestamp from first firing alert or earliest error log>

---

## Executive Summary

[2–3 sentences: what is broken, user impact, current state]

---

## WHAT — Impact

| Metric | Current Value | SLO | Status |
|--------|---------------|-----|--------|
| Error rate | X% | < 10% | OK / WARNING / BREACH |
| p95 latency (worst route) | Xms | < 1000ms | OK / WARNING / BREACH |
| RPS | X req/s | — | — |
| Firing alerts | X total | 0 | OK / FIRING |

**Affected routes:**
| Route | Error% | p95 | RPS |
|-------|--------|-----|-----|
| /api/... | X% | Xms | X/s |

---

## WHERE — Localization

| Layer | Status | Detail |
|-------|--------|--------|
| App | OK / DEGRADED | [notes] |
| Redis | OK / DEGRADED | cache hit X% |
| External | — | — |

**Error log sample:**
```
[paste 2–3 representative error log lines]
```

**Top 5 traces (table with working Explore links):**

| # | Trace ID | Route / Endpoint | Time (UTC) | Link |
|---|----------|------------------|------------|------|
| 1 | `<traceId>` | from log `endpoint` or msg | `<time>` | [View trace](<URL built per Step 5>) |
| 2 | ... | ... | ... | ... |
| … | (up to 5 rows) | | | |

Use the trace link format from Step 5 (schemaVersion=1 + panes with queryType traceql, query = traceId). Do not use a bare `left=...` Explore URL — it opens empty.

---

## WHY — Root Cause

| Resource | Value | Threshold | Status |
|----------|-------|-----------|--------|
| CPU | X% | < 80% | OK / ELEVATED |
| Heap | X MB (X%) | < 200 MB | OK / ELEVATED |
| GC rate | X s/s | < 0.1 s/s | OK / ELEVATED |
| Cache hit ratio | X% | > 70% | OK / DEGRADED |
| Active connections | X | — | — |

**Root cause:** [specific causal chain based on collected data]

**Contributing factors:**
- [factor 1]
- [factor 2]

---

## HOW — Actions

**Owner roles:** Assign exactly one per action so it is clear who does what.
- **on-call** — Verification, rollback, restart, scaling, user impact checks.
- **developer** — Code changes, app fixes, feature flags (see suggest reports).
- **devops** — Grafana/dashboards, alert rules, silences, infra/config.

### Immediate
| Priority | Action | Owner |
|----------|--------|-------|
| 1 | [concrete remediation step] | on-call / developer / devops |
| 2 | [rollback / scaling / restart] | on-call |

### Alerts state
| Layer | Alert | State | Current value | Threshold |
|-------|-------|-------|---------------|-----------|
| Grafana | alert-high-cpu | normal/firing | X% | > 80% |
| Grafana | alert-high-memory | normal/firing | X MB | > 200 MB |
| Grafana | alert-high-latency | normal/firing | Xms | > 2s |
| Grafana | alert-high-error-rate | normal/firing | X% | > 15% |
| Prometheus | HighCpuUsage | normal/firing | X% | > 5% |
| Prometheus | HighHeapMemory | normal/firing | X MB | > 200 MB |
| Prometheus | HighAvgResponseTime | normal/firing | Xms | > 2s |
| Prometheus | HighErrorRate | normal/firing | X% | > 15% |
| Prometheus | AppDown | normal/firing | up=0/1 | up==0 |

### Code fix recommendations
Run `/grafana-suggest` for file/line-level code changes.
See `.cursor/out/suggest-*.md` for any existing suggestion reports.

---

## Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | [first signal / alert fired] |
| HH:MM | [incident detected] |
| HH:MM | [investigation started] |
| HH:MM | [resolution / ongoing] |

---

## Action Items

| # | Item | Priority | Owner |
|---|------|----------|-------|
| 1 | [follow-up fix or process improvement] | P1/P2/P3 | on-call / developer / devops |
| 2 | [monitoring gap to close] | — | devops |

---

### Related reports

- [This incident report](.cursor/out/incident-<YYYY-MM-DD-HH-MM>.md)
- [Suggestions report (same run)](.cursor/out/suggest-<YYYY-MM-DD-HH-MM>.md)

---

*Generated by /grafana-incident at <timestamp>*
```

---

## Output

After writing the file, respond with:
1. The absolute path to the written report
2. A brief inline summary (severity + top finding + immediate action)
