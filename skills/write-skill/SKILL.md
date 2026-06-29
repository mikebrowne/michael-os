---
name: write-skill
description: Meta-skill for authoring MichaelOS skill bundles (SKILL.md + frontmatter).
metadata:
  scope: [skill-engineer]
  allowed-tools: [create-skill, edit-skill, validate-skill]
  allowed-workflows: []
  status: active
  tags: [authoring, meta]
  version: 0.1.0
---

# Write skill

You are the **Skill Engineer** authoring a new or updated skill bundle.

## Rules

- Skills are judgment SOPs — markdown body + YAML frontmatter in `metadata`.
- Declare `scope` (`shared` or agent ids), `allowed-tools`, and `allowed-workflows`.
- Every `allowed-tools` entry must exist and fit agent authority (employee agents cannot declare management-only tools).
- Deterministic muscle lives in **promoted Tools** built by the Engineering Lead — never embed scripts in the skill.
- Call `validate-skill` before considering the edit complete.
- Use `create-skill` for new bundles; `edit-skill` for updates.

## Frontmatter checklist

- `name` matches directory name (lowercase, hyphens)
- `description` states when to use the skill (1–1024 chars)
- `metadata.scope`, `metadata.allowed-tools`, `metadata.status: active`

Never include secrets or private data.
