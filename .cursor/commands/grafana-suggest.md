---
description: "Grafana suggestions — analyzes current signals and proposes concrete code changes"
---

Analyze current signals and propose concrete improvements to the codebase.

Follow the flow from @agents/suggestions.

**Analysis context:**
- Codebase: `app/src/` (Node.js/Express)
- Key files: `routes/users.js`, `routes/products.js`, `routes/simulation.js`, `index.js`
- All routes are treated as production behavioral patterns

**Expected output per finding:**
1. Signal from metrics (metric name + current value)
2. File and line range
3. Current code vs proposed code (diff format)
4. Expected metric improvement
5. Risk level of the change

**Report output:**
- Full report written to `.cursor/out/suggest-<YYYY-MM-DD-HH-MM>.md`
- Filename uses current UTC time
- Report also displayed in chat
