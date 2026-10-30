---
name: ship-check
description: Run every check FarmCrate requires before a pull request and summarize the results.
disable-model-invocation: true
allowed-tools:
  - Bash(npm run lint)
  - Bash(npm run typecheck)
  - Bash(npm test)
  - Bash(npm run build)
  - Bash(git status)
  - Bash(git diff *)
---

Run, in this order, and stop at the first failure to explain it:

1. `git status` (list uncommitted files; warn about any file that looks like a secret)
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

Then write a pull request description with the sections of
.github/pull_request_template.md, filled in from `git diff main...HEAD`.
Say which parts an agent wrote and which checks you ran, with their result.
