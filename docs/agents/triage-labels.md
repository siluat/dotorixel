# Triage Labels

The skills speak in terms of five canonical triage roles. In this repo, those roles are expressed by setting the `status:` field in each issue file's YAML front-matter.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

Additional workflow states already in use (e.g. `in-progress`, `done`) are preserved; the triage skill only applies the five canonical labels above.

## Usage

Set or update the `status:` value in the issue's front-matter to one of the labels above.

```yaml
---
title: ...
status: ready-for-agent
created: YYYY-MM-DD
---
```

When a skill says "apply the AFK-ready triage label", set `status: ready-for-agent`.
