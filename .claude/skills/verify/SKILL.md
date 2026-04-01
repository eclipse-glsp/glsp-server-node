---
name: verify
description: Run full project validation (install, lint, test, format, copyright headers) to catch issues before committing. IMPORTANT - Proactively invoke this skill after completing any code changes (new features, bug fixes, refactors) before reporting completion to the user.
---

Run the full validation suite for the GLSP Server Node monorepo from the repository root (includes install, lint, test, format check, and copyright header check):

```bash
yarn check:all
```

On failure:

1. Report which checks failed and the specific errors
2. Auto-fix by invoking the `/fix` skill
3. Re-run `yarn check:all` to confirm everything passes
