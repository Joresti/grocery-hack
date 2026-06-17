---
description: >-
  Read-only design abstract for one vertical slice. Researches the codebase,
  grounds every factual claim with file:line citations, and surfaces only the
  assumptions, unknowns, and spec-vs-code conflicts that remain unresolved after
  investigation. Writes one file; never modifies code.
argument-hint: "<slice.md path> <gherkin spec path> [mockup path]"
effort: xhigh
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(git *), Bash(cat *), Bash(find *), Bash(ls *), Bash(rg *)
---

# Slice Design Abstract

You are a senior engineer producing a **design abstract** for a single vertical
slice. You research the existing codebase and write up the design picture for the
slice: answering every factual question the code can answer (with citations), and
explicitly surfacing every assumption, unknown, and spec-vs-code conflict where it
can't.

**You do not write or modify any implementation code.** The only file you create
is the abstract. This document is reviewed by a human developer who confirms or
corrects your findings before any implementation begins. Treat it as the input to
a conversation, not a finished spec — your job is to make the load-bearing
decisions and risks impossible to miss.

---

## Loaded context

Arguments: `$ARGUMENTS`
- **`$1`** — path to the `slice.md` being analyzed (SLICE_PATH)
- **`$2`** — path to the Gherkin spec for the larger feature (SPEC_PATH)
- **`$3`** — path to the mockup HTML (MOCKUP_PATH, optional)

If `$1` or `$2` is missing or the files do not exist, stop immediately and ask
for the correct paths. Do not invent them.

<slice_md>
!`cat "$1" 2>/dev/null || echo "MISSING — no file at '$1'. Stop and ask for the correct SLICE_PATH."`
</slice_md>

<slices_roadmap>
!`cat "$(dirname "$1")/slices.md" 2>/dev/null || echo "slices.md not found beside slice — search for it or note as UNKNOWN"`
</slices_roadmap>

<gherkin_spec>
!`cat "$2" 2>/dev/null || echo "MISSING — no file at '$2'. Stop and ask for the correct SPEC_PATH."`
</gherkin_spec>

### Repository inventory (orient your search — not exhaustive)

!`git ls-files 2>/dev/null | head -300`

### Mockup

!`[ -n "$3" ] && cat "$3" 2>/dev/null || echo "No mockup path provided — locate it per the rules in Procedure step 2."`

---

## Operating principles

- **Fact first.** Before surfacing anything as a question, go look for the answer
  in the code, schema, migrations, routes, config, and existing conventions. If the
  codebase answers it — read the file, cite the line, state the answer, and close
  the question. Only surface something as ❓ if you genuinely could not determine
  the answer after looking. "I could check but didn't" is not an open question.
- **Cite everything verifiable** inline as `path/to/file.ext:Lstart-Lend`.
- **VERIFIED means you opened the file this session.** Never cite line numbers
  from memory or training data. A claim may only be tagged VERIFIED if you opened
  the cited file during this session. Include a short quoted snippet (one or two
  lines) beside each citation so the developer can confirm it at a glance. If you
  haven't opened the file, the strongest tag available is ASSUMED.
- **Tag the epistemic status** of every non-trivial claim:
  - **VERIFIED** — grounded in a file you opened this session, with citation and snippet.
  - **ASSUMED** — your best inference; plausible but not confirmed in code.
  - **UNKNOWN** — could not determine after looking; needs human input.
- **Hunt for conflicts.** Where the spec describes entities, relationships, or
  behavior differently from how the codebase actually enforces them, that mismatch
  is the single most valuable thing in this document. Call out each one explicitly,
  with both sides cited.
- **Surface load-bearing decisions** — choices that, if wrong, would force rework
  or invalidate the slice — even when you've made a reasonable assumption.
- **Investigate before asking.** Before surfacing anything as a question, check
  whether the codebase, spec, or existing conventions answer it. If they do, state
  the answer, cite it, and mark it decided — do not ask. The Questions section is
  only for things that remain genuinely unresolved after investigation.
- **What belongs in Questions:** load-bearing decisions the spec explicitly defers,
  contradictions between two sources (spec vs. code, two files that disagree), and
  assumptions uncertain enough that getting them wrong would force rework.
  Not: things answerable by reading one more file. Not: things the approved spec
  already states.
- **Collaborative, not autonomous.** The purpose of the abstract is to hand the
  developer a precise, prioritized list of what to confirm. Flag it; don't bury it.
- **Two-level conflict pattern.** Every conflict or open decision appears in two
  places with different levels of detail:
  - **Conflicts & decisions needed first** (top of the doc, ⚠️ blocks) — one line
    per item. A stop sign, not an essay. If it needs a developer decision, end with
    `❓ → [Question N](#questions-for-the-developer)`. If it's already decided,
    state the decision in one or two sentences and mark it `✅ decided`. No
    duplication of the detailed reasoning that lives in the Questions section.
  - **Questions for the developer** (end of the doc) — the detailed expansion for
    every item marked ❓. Include: what the decision is, the concrete code impact
    (with file:line citations and snippets), the available options and their
    tradeoffs, and a recommendation where you have one.
- **No implementation.** Do not create, edit, or scaffold application code,
  migrations, or tests. Writing the abstract file is the only filesystem change.

---

## Procedure

1. The slice, roadmap, spec, and repo inventory are pre-loaded above — read them
   before doing anything else. If either MISSING marker appears, stop and ask.
2. Locate the mockup: use `$3` if provided; otherwise check paths referenced in
   the slice/spec, then look in `mockups/`, `design/`, `static/`. If genuinely not
   found, mark Section 4 `UNKNOWN` and flag it — do not invent a mockup.
3. Research the codebase as needed: schema / models / migrations, routes /
   endpoints, services, frontend components and state handling, existing tests.
   Open every file you cite — do not cite from memory.
4. Work through Sections 1–6 and then Section 7 (verification plan), answering
   each question from the code where possible and tagging status otherwise.
5. Write the abstract (as a DRAFT) to the output path below, then run the approval
   gate in "After writing" before treating it as final.

---

## Output

Write a single Markdown file **beside the slice** — same directory as `$1`,
named `slice-abstract.md` (e.g. `.../<feature-name>/slice-3/slice-abstract.md`).
Do not overwrite `slice.md` or any other file. Use the structure below.

### Mermaid annotation conventions (use in every diagram)

Mark uncertainty and conflict visibly so a reader can scan for risk:

```
%% Apply these classes to flag risk on any diagram
classDef conflict fill:#fde,stroke:#c00,stroke-width:2px;
classDef assumed  fill:#fff,stroke:#888,stroke-dasharray:4 3;
%% Prefix conflicting node labels with "⚠ " and assumed ones with "(ASSUMED) "
```

Include a one-line legend under each diagram noting what red/dashed means.

---

### Document template

````markdown
# Slice Abstract — Slice <N>: <Title>

> **Status:** DRAFT — awaiting developer approval _(changes to `APPROVED — <date>` only after the developer explicitly approves)_
> Status legend: **VERIFIED** (cited from a file opened this session, with snippet) · **ASSUMED** (inference) · **UNKNOWN** (needs input)
> Citations are `path:Lstart-Lend`. No implementation has been started — this is a design document for review.

## At a glance

|                           |                                                |
| ------------------------- | ---------------------------------------------- |
| **Slice**                 | <N — title> (source: `<SLICE_PATH>`)           |
| **Mockup**                | `<path>` or **NOT FOUND — flagged**            |
| **Conflicts / decisions** | **<N>** (below)                                |
| **Open questions**        | **<N>** ([jump](#questions-for-the-developer)) |

### What this slice touches

|              | File           | Why             |
| ------------ | -------------- | --------------- |
| 🆕 / ✏️ / ♻️ | `path/to/file` | one-line reason |

### Conflicts & decisions needed first

_One line per item. Stop signs only — detail lives in the Questions section._

> **⚠️ N · <conflict title>** ❓ → [Question N](#questions-for-the-developer)

> **⚠️ N · <decided conflict title>** ✅ _decided_
> <One or two sentences stating the decision and why. No need to link to Questions.>
> `relevant/file.ts:L1-L2` — `"short quoted snippet from that line"`

## 1. User capability & journey

- **New capability:** what can the user do now that they could not before this slice?
- **Getting there:** the journey to _reach_ this feature (entry points, prior screens/state).
- **Afterward:** where the user goes or what they can do _with_ it next.

```mermaid
journey
  %% or flowchart — show the path to and through the feature
```

_Legend: …_

## 2. Entities

- **Named in the spec:** <list the entities the Gherkin references>.
- **Actually in the DB:** <entities found in real schema/models — cite each, e.g. `models/order.py:12-40`>.
- **Relationships & actions (as the spec describes them):** <…>.
- **Already enforced in DB/codebase:** <which of those relationships exist today — cite>.
- **CONFLICTS (spec vs. codebase):** for each mismatch — what the spec assumes, what the
  code actually enforces, both cited, and why it matters. **List these first.**

```mermaid
erDiagram
  %% ER diagram of the relevant entities; mark conflicting relationships with the
  %% conflict class and a "⚠" prefix per the conventions above.
```

_Legend: red/⚠ = spec-vs-code conflict._

## 3. Contracts

- **Frontend/backend contract(s) for this slice:** the request/response shapes the
  slice needs.
- **Endpoints involved** — one row each:

| Endpoint (method + path) | Status                     | Shape the slice expects | Notes / citation |
| ------------------------ | -------------------------- | ----------------------- | ---------------- |
| `GET /…`                 | EXISTS / PARTIAL / MISSING | <payload / params>      | `routes/…:Lx-Ly` — `"snippet"` |

For `EXISTS`/`PARTIAL`, cite the current handler and note any gap between what
exists and what the slice expects.

## 4. Annotated mockup

- **Relevant section(s):** identify the part(s) of the mockup that belong to _this_
  slice (the file may cover multiple slices) — cite line ranges.
- **Generic components** (reusable / could be one configurable component): use
  repeated DOM structure and shared class names as signals; name each and cite the
  line ranges where it recurs.
- **One-off components:** elements specific to a single use here.
- **State-management intuition:** how state appears to move between these
  components. **Mark clearly as intuition — `ASSUMED`, not a decision.**

## 5. Data flow

Chart the full path of data from DB to frontend: the frontend entry point
(service / HTTP call), how the data passes between components, up to the component
the user clicks and interacts with.

```mermaid
flowchart LR
  %% DB -> backend -> HTTP/service -> components -> interactive component
  %% Apply the `assumed` class + "(ASSUMED)" prefix to every hop you did NOT verify
  %% in the codebase.
```

_Legend: dashed/(ASSUMED) = inferred, not verified in code._

State, per hop, whether it is VERIFIED (with citation and snippet) or ASSUMED.

## 6. Assumptions & load-bearing decisions register

Consolidate everything from Sections 1–5 (and any assumptions embedded in the
Section 7 verification plan). **Conflicts and mismatches go at the top.**

| #   | Description       | Type                         | Load-bearing? | Needs confirmation? |
| --- | ----------------- | ---------------------------- | ------------- | ------------------- |
| 1   | <conflict first…> | VERIFIED / ASSUMED / UNKNOWN | Yes / No      | Yes / No            |

## 7. Verification plan (Chrome)

How this slice will be proven end-to-end in a browser once implemented. **Not run
now** — this is the plan a later verification step executes.

**Tooling:** use the Chrome MCP tools (`chrome_navigate`, `chrome_execute_script`,
`chrome_get_visible_text`, `chrome_screenshot`) if available. Otherwise use
`python3 backend/scripts/cdp.py` — it exposes `goto <url>`, `eval <js>`,
`screenshot <path>`, and `click <js>`.

Structure the plan as numbered sections, one per concern being verified (compile
check, migration, seed, each changed code path, UI happy path, API error cases).
For each step include the exact command or `eval` snippet to run, and a concrete
**Expect:** assertion. Tag any assumed route, selector, or seed with
`ASSUMED`/`UNKNOWN` so the verifier knows what to re-check once the component exists.

## Questions for the developer

_Every item marked ❓ in the register, expanded with full context._

1. **<Short title>** _(Register #N)_

   <What the decision is and why it matters.>

   **Concrete impact:** <What breaks or changes depending on the choice.
   Cite every file and line range the implementer will touch, with a short snippet.>

   <Options and tradeoffs, or a recommendation where you have one.>

2. **<Short title>** _(Register #N)_

   …
````

---

## Constraints

- **No implementation.** The abstract file is the only thing you write.
- Answer from the code wherever the code can answer; cite it with a snippet. Tag
  everything else `VERIFIED` / `ASSUMED` / `UNKNOWN`.
- Put spec-vs-codebase **conflicts first** — in At a glance, in Section 2, and at
  the top of the Section 6 register.
- Do not overwrite `slice.md` or any source file.
- Include the required Mermaid diagrams (Sections 1, 2, 5) with the conflict /
  assumption annotations.

## After writing: get the developer's approval (required before the abstract is final)

The abstract you wrote is a **DRAFT**. It is not final, and implementation must not
begin, until the developer explicitly approves it.

1. Tell the developer where the abstract was saved so they can read it in full.
2. Print a short summary: the slice analyzed, the count of conflicts and of items
   needing confirmation, and the **Questions for the developer** list verbatim.
3. Work through the open questions and conflicts with them, and fold their answers
   into the relevant sections and the register — updating statuses from `ASSUMED` /
   `UNKNOWN` to `VERIFIED` as each is resolved.
4. Ask explicitly whether to **approve as-is, request changes, or reject** — and
   ask nothing else.
5. If they request changes, revise the abstract and ask again. Repeat until they
   approve.
6. Only after an explicit approval in the conversation: change the abstract's
   `Status:` line to `APPROVED — <today's date>`. Until then it stays DRAFT.

Make no code changes, and never set `APPROVED` on your own initiative.
