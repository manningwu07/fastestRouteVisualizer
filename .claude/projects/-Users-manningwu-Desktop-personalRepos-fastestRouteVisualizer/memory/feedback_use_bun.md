---
name: Use bun not npm
description: User wants bun as the package manager/runtime, not npm
type: feedback
---

Always use bun instead of npm for this project (and likely all projects).

**Why:** User explicitly corrected this — they were frustrated that npm was used without asking.

**How to apply:** Use `bun install`, `bun run`, `bunx` etc. everywhere. When spawning subagents, explicitly instruct them to use bun. Never default to npm.
