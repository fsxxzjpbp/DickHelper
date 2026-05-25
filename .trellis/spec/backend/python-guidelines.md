# Python Guidelines

> When writing Python scripts in this project (CI helpers, build tooling, data migration, etc.), use `uv` as the standard runner and package manager.

---

## Core Principle

**Always use `uv` to run Python scripts.** Never invoke `python` or `pip` directly when `uv` can do the job. `uv` provides deterministic environments, fast resolution, and inline dependency declarations without requiring a project-wide virtual environment setup.

---

## Rules

### 1. Use `uv run`, not bare `python`

All Python scripts in the project must be executed via `uv run`:

```bash
# Correct
uv run scripts/migrate_data.py

# Wrong
python scripts/migrate_data.py
```

If the script lives outside a `pyproject.toml` project, use inline script metadata (see Rule 3) so that `uv run` can still resolve dependencies.

### 2. Dependencies are OK

Do not avoid third-party packages at the cost of writing complex workarounds with only the standard library. When a dependency solves the problem well, add it:

```bash
uv add httpx
```

This avoids hand-rolled HTTP clients, fragile date parsers, etc. Prefer a well-maintained package over reinventing the wheel.

### 3. Declare dependencies properly

Every Python script must make its dependencies discoverable. Choose one of:

**Option A: Inline script metadata** (preferred for standalone scripts)

```python
# /// script
# dependencies = [
#     "httpx",
#     "rich",
# ]
# ///

import httpx
from rich import print
...
```

**Option B: `pyproject.toml`** (for multi-script tool directories)

```toml
[project]
name = "my-tools"
version = "0.1.0"
dependencies = [
    "httpx",
    "rich",
]
```

Run with `uv run scripts/tool.py` in either case.

**Wrong**: A script that `import httpx` at the top but has no metadata file — the next developer won't know what to install.

---

## CI / Script Invocation

In GitHub Actions workflows, invoke Python scripts consistently:

```yaml
- name: Run migration script
  run: uv run scripts/migrate.py
```

If the repository doesn't yet have `uv` in the CI image, install it first:

```yaml
- name: Install uv
  uses: astral-sh/setup-uv@v5
```

---

## Summary

| Do | Don't |
|----|-------|
| `uv run script.py` | `python script.py` |
| `uv add httpx` | Manual `pip install httpx` |
| Inline metadata or `pyproject.toml` | Undocumented imports |
| Import `httpx` when it solves the problem | Write manual `urllib` code to avoid a dependency |
