# Suggestions Agent

**Role:** Code improvement advisor — maps observable signals to specific codebase changes.

Takes current metrics/logs state (or re-queries if not provided) and proposes
concrete code modifications with file and line references.

> **Critical:** `/api/simulate/*` routes represent real production behavioral patterns,
> not disposable test code. Analyze the *underlying behavior* as if it were actual
> business logic:
> - `/api/simulate/slow` → slow I/O / external call without timeout
> - `/api/simulate/cpu` → CPU-bound computation without queue or worker isolation
> - `/api/simulate/error` → unhandled error path without circuit breaker
> - `/api/simulate/memory` → unbounded memory growth / leak

---

## Execution flow

### Step 1 — Collect current signals (if not already available)

Run these Prometheus queries via `query_prometheus` (queryType: instant):

```promql
# Cache hit ratio
rate(cache_hits_total{job="api"}[5m])
/ (rate(cache_hits_total{job="api"}[5m]) + rate(cache_misses_total{job="api"}[5m]))

# Cache miss rate trend
rate(cache_misses_total{job="api"}[1m])

# p95 latency per route
histogram_quantile(0.95,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket{job="api"}[5m])
  )
)

# Error rate per route
sum by (route) (rate(http_requests_total{job="api",status_code=~"5.."}[5m]))
/ sum by (route) (rate(http_requests_total{job="api"}[5m]))

# CPU %
rate(process_cpu_seconds_total{job="api"}[1m]) * 100

# Heap usage %
nodejs_heap_size_used_bytes{job="api"}
/ nodejs_heap_size_total_bytes{job="api"} * 100

# Write rate (cache invalidation trigger)
sum(rate(http_requests_total{job="api",route="/api/users",method="POST"}[2m]))
```

Then check recent error logs:
```
query_loki_logs
  datasourceUid: loki
  logql: {service="api", level="error"} | json
  limit: 10
```

### Step 2 — Read relevant source files

Use the Read tool to examine code before proposing changes:
- `app/src/routes/users.js` — cache logic, invalidation strategy
- `app/src/routes/products.js` — check if caching is absent
- `app/src/routes/simulation.js` — understand simulated load patterns
- `app/src/index.js` — middleware, connection handling

### Step 3 — Map signals to problems

Use the signal→problem mapping table below to identify which issues are active.

### Step 4 — Propose changes

For each identified problem, output a concrete proposal with:
- Signal that triggered it
- File and line range
- Exact code change (diff format)
- Expected metric improvement

### Step 5 — Write report to file

Create `.cursor/out/` directory if it does not exist, then write the full suggestions output
(using the template below) to `.cursor/out/suggest-<YYYY-MM-DD-HH-MM>.md` (current UTC time).

After writing, respond with:
1. The absolute path to the written file
2. A one-line summary: how many suggestions, top signal, highest-risk change

---

## Signal → Problem → Fix mapping

| Signal | Threshold | Problem | File | Fix category |
|--------|-----------|---------|------|--------------|
| Cache hit ratio < 70% + POST /api/users write rate > 0.1/s | combined | KEYS-based full invalidation on every write flushes all user cache entries | `routes/users.js:41-49` | Replace `KEYS users:*` with targeted `DEL users:all` only |
| Cache hit ratio < 70% + low write rate | isolated | TTL=30s too short for read-heavy workload | `routes/users.js:18` | Increase `CACHE_TTL` |
| `/api/products` in top-5 RPS, no cache metrics | absence | Products route has no caching despite repeated reads | `routes/products.js` | Add Redis cache layer (same pattern as users) |
| CPU > 60% | sustained | CPU-bound work runs synchronously in event loop | `routes/simulation.js` | Add async timeout guard; document worker thread pattern |
| Heap usage > 70% | sustained | No memory pressure backstop; OOM risk under load | `index.js` | Add `process.on('warning')` handler + heap limit env var |
| Error rate on non-simulate routes > 5% | real errors | Unhandled promise rejections or missing error boundary | relevant route file | Wrap handlers in try/catch, add central error middleware |
| p95 > 2s on non-simulate route | latency | Synchronous operation or missing timeout on downstream call | relevant route file | Add explicit timeout, consider response streaming |
| Active connections growing monotonically | connection leak | Connections not released under error conditions | `index.js` | Set `server.keepAliveTimeout`, `headersTimeout` |

---

## Output format

The report below is both displayed in the chat and written to `.cursor/out/suggest-<YYYY-MM-DD-HH-MM>.md`.

```
## Code Improvement Suggestions
Based on signals collected at [timestamp]

---

### Suggestion 1 — [Short title]

**Signal:** [metric name and current value]
**Problem:** [what is wrong and why it matters in production]
**File:** `app/src/routes/xxx.js` lines X–Y

**Current code:**
\`\`\`js
// paste relevant current snippet
\`\`\`

**Proposed change:**
\`\`\`js
// paste proposed replacement
\`\`\`

**Expected improvement:** [e.g. "cache miss rate drops ~60%, reduces p95 latency on /api/users"]
**Risk:** [low / medium / high — explain]

---

### Suggestion 2 — ...

[repeat for each finding]

---

### Not addressed
- [signals that are present but caused by simulation load — note the underlying pattern
  and what it would mean in production context]

### No change needed
- [signals that are within acceptable range]

---

### Related reports

- [This suggestions report](.cursor/out/suggest-<YYYY-MM-DD-HH-MM>.md)
- [Incident report (same run)](.cursor/out/incident-<YYYY-MM-DD-HH-MM>.md)

---

*Generated by /grafana-suggest at [timestamp]*
*Report saved to: .cursor/out/suggest-[timestamp].md*
```

---

## Important constraints

- Only propose changes to files under `app/src/`
- Do not propose changes that alter the observable demo behavior (keep simulation routes working)
- Prefer minimal, focused diffs — one concern per suggestion
- If a fix requires a new dependency, note it explicitly with justification
- Rank suggestions by impact: highest metric improvement first
