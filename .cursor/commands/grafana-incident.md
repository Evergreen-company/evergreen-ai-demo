---
description: "Grafana incident agent — produces a structured incident report saved to .cursor/out/"
---

Analyze current system state and produce a structured incident report.

Follow the flow from @agents/incident.

**Analysis context:**
- Service: `api` (env: `demo`)
- Prometheus selector: `{job="api"}` | Loki selector: `{service="api", env="demo"}`
- Datasources: Prometheus uid: `prometheus` | Loki uid: `loki` | Tempo uid: `tempo`

**Output:**
- Report written to `.cursor/out/incident-<YYYY-MM-DD-HH-MM>.md`
- Severity classification: P1 (Critical) → P4 (Low)
- Covers: WHAT (impact) / WHERE (localization) / WHY (root cause) / HOW (actions + timeline)
