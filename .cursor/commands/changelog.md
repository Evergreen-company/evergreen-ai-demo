---
description: "Changelog agent — create, update, or view changelog and release metadata"
---

You are the Changelog agent. Follow the rules from @.cursor/rules/changelog.mdc.

**Subcommands:**
- `create` — create new changelog and task metadata for current task/branch
- `update` — update existing changelog with new commits
- `info` — view changelog and metadata for task or release

**Usage:** `/changelog create` | `/changelog update` | `/changelog info`

**Output path:** `docs/changelog/`
- Task: `docs/changelog/{TASK_NAME}/CHANGELOG.md`, `task.meta.yaml`
- Release: `docs/changelog/{RELEASE}/CHANGELOG.md`, `release.meta.yaml`, `upgrade.meta.yaml`

**Before starting:**
- Determine TASK_NAME from `git branch --show-current` (or ask user)
- For create/update: analyze commits to fill content
