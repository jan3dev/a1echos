---
description: Update the repo's manual test checklist CSV with cases for a newly built feature
argument-hint: [feature description or area; optional — defaults to the recent diff]
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(python3:*), Bash(find:*), Bash(ls:*), Glob, Grep, Read, Edit, Write
---

You maintain the project's **manual QA test checklist** (CSV format). The user
just built a feature and wants matching manual-test rows added.

## 1. Locate the checklist

Find the manual test checklist CSV in the repo:

```
find . -path ./node_modules -prune -o \( -iname "*checklist*.csv" -o -iname "*manual*test*.csv" -o -iname "*qa*.csv" \) -print
```

- If exactly one matches, use it.
- If several match, pick the one whose area matches the feature; if still
  ambiguous, ask the user which file.
- If none exists, ask the user whether to create one (and where) before writing.

`Read` the file. Infer its **exact schema from the existing rows**, do not assume:
the column header, the per-section ID prefix scheme (e.g. `CAP-01`, `SUG-03`),
the `Section` grouping, the `Platforms` vocabulary (e.g. `iOS+Android`, `iOS`,
`Android`), the empty pass columns, and the `Notes` convention (e.g.
`Phase 3 §5.5`). New rows MUST match this format and CSV quoting style exactly
(wrap any field containing a comma or quote in double quotes; escape literal
quotes as `""`).

## 2. Identify the feature under test

If `$ARGUMENTS` is given, treat it as the feature/area to cover. Otherwise infer
it from the working tree and recent history:

```
git status --short
git diff HEAD --stat
git log --oneline -5
```

Read the actually-changed source for the feature so the test steps reflect
**real behavior, not assumptions** — exact thresholds, defaults, opt-out fields,
platform differences, and edge cases. Note any iOS/Android asymmetry (some rows
will be single-platform).

## 3. Derive test cases

Write one row per observable behavior and edge case, including:
- the happy path,
- defaults / opt-outs / disabled states,
- boundary conditions (length limits, windows/timeouts, empty input),
- platform-specific behavior (set `Platforms` accordingly),
- interactions with adjacent features the change touches.

Continue the existing ID numbering for the matching section (or start a new
section + prefix if the feature is genuinely new — pick a short uppercase prefix
not already in use). **Insert rows in the file's existing order** (these files
are typically grouped/sorted by ID prefix — place a new section where its prefix
sorts).

Prefer `Edit` to splice rows at the right location over appending blindly. If the
feature **changed** existing behavior, update the affected existing rows rather
than duplicating them. Leave the pass/result columns blank — they're filled in
during manual testing.

## 4. Validate

After editing, confirm the CSV is still well-formed (every row has the same
column count as the header) and report what you added/changed:

```
python3 -c "import csv;rows=list(csv.reader(open('PATH')));h=len(rows[0]);bad=[(i+1,len(r)) for i,r in enumerate(rows) if len(r)!=h];print('cols',h,'rows',len(rows),'malformed',bad or 'none')"
```

Finish with a short summary: which file, which section/IDs were added or updated,
and any behavior you couldn't fully verify from the code (so the tester knows to
double-check it).
