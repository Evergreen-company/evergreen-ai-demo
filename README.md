# evergreen-ai-demo

Demo: Node.js API with full LGTM observability stack (Grafana, Loki, Tempo, Prometheus, Alloy) and Cursor AI agents for monitoring, alerting, and code improvement suggestions.

## Apps

| App | Description |
|-----|-------------|
| [ai-example](apps/ai-example/README.md) | Node.js API + full LGTM stack + Cursor AI agents |

## Repository Layout

```
aiobs/
├── apps/
│   └── ai-example/         # see apps/ai-example/README.md
└── .cursor/                # workspace-level Cursor config (rules, agents, commands)
```
