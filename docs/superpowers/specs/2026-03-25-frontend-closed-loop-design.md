# Frontend Closed-Loop Design

Date: 2026-03-25
Project: PowerJulia / JGDO
Scope: Engineering-oriented frontend closed loop for building a topology from an empty canvas, validating it, running power flow, and reviewing results.

## Context

The repository already has a usable Julia computation core, sample topology conversion, power flow execution, optimization support, and a migrated JointJS-based frontend shell. What is still missing is a reliable product-grade frontend workflow for engineering use.

The existing frontend has valuable pieces in place:
- a palette and canvas
- dialogs for parameter editing and validation
- import/export controls
- run buttons and progress UI hooks
- help, legend, zoom, and history containers

The current gap is not "missing UI entirely", but "the user journey is not yet a dependable engineering workflow". Editing, validation, run gating, and result presentation need to work as one system.

This design intentionally narrows scope relative to the broad `complete-project-features` OpenSpec change. The first target is a complete frontend loop, not every remaining project feature.

## Goals

- Support an engineering-first workflow from empty canvas to successful power flow result.
- Fully support these element types in the first stage:
  - `Bus`
  - `Line`
  - `Load`
  - `Gen`
  - `DG`
  - `Switch`
- Make parameter entry strict, explicit, and traceable.
- Prevent invalid topologies from reaching the backend whenever the frontend can detect the issue.
- Present run status, failures, and results in a way that is easy to diagnose.
- Preserve JSON import/export and local draft recovery as stable data paths.

## Non-Goals

- No first-stage redesign around optimization-first workflows.
- No multi-user collaboration, project database, or server persistence.
- No full report generator, dashboard system, or complex analytics suite.
- No attempt to fully solve every Electron packaging concern in this design.
- No support for every current palette item if it weakens the initial closed loop.

## Primary User Story

An engineer starts from an empty canvas, places buses and connected equipment, fills in parameters, resolves validation issues, runs AC power flow, and inspects the results directly on the canvas and in a structured side panel.

Success means:
- the topology can be created without hidden steps
- missing or invalid data is clearly surfaced before running
- the run action is gated by error-level validation
- successful results are visible both as summary and per-element detail
- failed runs provide actionable feedback instead of opaque alerts

## Product Shape

The product remains a single-page workbench:
- top toolbar for file, run, and view actions
- center canvas as the main editing surface
- right sidebar as the contextual panel

The sidebar changes role based on context:
- nothing selected: project summary, validation summary, readiness state
- element selected: parameter form and field-level validation
- run completed: result summary and selected element result detail

This keeps the current application shell but upgrades it into a coherent workflow rather than a collection of separate widgets.

## Workflow States

The frontend should make the current work state explicit. The main state machine is:

1. `editing`
2. `needs_validation`
3. `blocked`
4. `ready_to_run`
5. `running`
6. `run_succeeded`
7. `run_failed`

Expected behavior by state:
- `editing`: user is changing topology or parameters
- `needs_validation`: topology changed and full validation has not been refreshed
- `blocked`: one or more error-level findings prevent running
- `ready_to_run`: no error-level findings remain
- `running`: run controls lock and progress feedback is shown
- `run_succeeded`: latest result is attached to the topology snapshot
- `run_failed`: topology remains editable and the error view stays inspectable

## Supported Elements and Field Model

The first stage supports these engineering fields.

### Bus
- `id`
- `kv`
- `is_slack`
- `vm_pu`
- `va_deg`

### Line
- `id`
- `r_ohm`
- `x_ohm`
- `rate_mva`

### Load
- `id`
- `p_kw`
- `q_kvar`

### Gen / DG
- `id`
- `p_kw`
- `p_max_kw`
- `q_kvar`
- `q_max_kvar`
- `status`

### Switch
- `id`
- `status`
- `r_ohm`
- `x_ohm`
- `rate_mva`

Field rendering rules:
- every field shows label, unit, and validation help
- required fields are marked consistently
- defaults are explicit, not hidden
- read-only derived values are visually different from editable inputs
- topology relationships are created on the canvas, not by manually typing endpoint ids in forms

## Architecture

The frontend should be reorganized into six logical modules. They may still live in a small number of files initially, but their responsibilities must be separated.

### 1. CanvasEditor

Owns:
- palette interactions
- node placement
- dragging
- edge creation
- selection
- deletion
- zoom and snapping
- visual overlays

Does not own:
- business validation
- backend calls
- result interpretation

### 2. TopologyStore

Acts as the single source of truth for:
- nodes
- links
- selection state
- ui state
- validation findings
- latest run payload
- run history summary
- dirty/draft status

Every major UI surface reads from this store. No component should maintain a conflicting private copy of topology data.

### 3. PropertyPanel

Renders forms by element type and writes changes back through the store.

Responsibilities:
- dynamic form selection by item type
- required-field indicators
- inline validation messages
- field descriptions and units
- disable/read-only logic where needed

### 4. ValidationEngine

Produces structured findings with:
- severity: `error` or `warning`
- target kind: `node`, `link`, `topology`, or `field`
- target id
- field key when applicable
- message
- remediation hint

Validation layers:
- structural validation
- parameter validation
- engineering rule validation

### 5. RunController

Coordinates:
- run prechecks
- request snapshot generation
- Julia/Electron bridge invocation
- progress and busy state
- success/failure normalization
- result persistence into the store

### 6. ResultsWorkbench

Consumes the latest normalized run result and selected object to present:
- run summary
- bus detail
- branch detail
- color/highlight instructions for canvas
- recent run history

## Data Model

The frontend needs an explicit normalized model. Suggested shape:

```js
{
  topology: {
    meta: { baseMVA, feeder },
    nodes: Record<string, NodeModel>,
    links: Record<string, LinkModel>
  },
  selection: {
    kind: "node" | "link" | null,
    id: string | null
  },
  validation: {
    findings: ValidationFinding[],
    lastValidatedAt: string | null,
    status: "unknown" | "blocked" | "ready"
  },
  run: {
    status: "idle" | "running" | "succeeded" | "failed",
    mode: "ac_pf" | "reconfiguration_dg" | null,
    requestFingerprint: string | null,
    result: object | null,
    error: object | null
  },
  history: {
    recentRuns: RunSummary[]
  },
  draft: {
    dirty: boolean,
    lastSavedAt: string | null
  }
}
```

Key rules:
- ids are stable and unique
- canvas view objects derive from the normalized model
- export serializes from the store, not directly from JointJS internals
- run results are stored separately from editable topology data

## Validation Strategy

Validation happens at two levels.

### Immediate Validation

Triggered on field change or topology edit.

Purpose:
- show local issues early
- mark invalid fields visually
- keep the readiness indicator current

Examples:
- missing required numeric field
- negative impedance
- invalid switch status
- duplicate id

### Pre-Run Validation

Triggered when the user clicks `Run Power Flow`.

Purpose:
- block invalid runs
- aggregate issues into a reviewable report
- create deterministic run gating

Error-level checks should include:
- no slack bus or more than one slack bus
- equipment not connected to a bus where required
- invalid line or switch endpoints
- illegal numeric ranges for required power system fields
- isolated topology sections detectable on the frontend

Warning-level checks may include:
- default initial voltage values left unchanged
- unusual but still legal ranges
- suspicious switch settings that may make the case less meaningful

Every finding must support navigation back to the relevant item and field.

## Run Experience

The run path for power flow is:

1. Capture a topology snapshot from the store.
2. Execute full validation.
3. If blocked, open the validation report and do not call the backend.
4. If valid, enter `running` state.
5. Lock destructive run controls while preserving view and inspection controls.
6. Send the JSON payload through the active bridge.
7. Normalize the response into frontend result shape.
8. Transition to `run_succeeded` or `run_failed`.

The run UI should provide:
- clear busy state
- textual phase feedback
- disabled run buttons while active
- a stable place to inspect the last failure

Cancellation can remain out of scope for the first implementation if the current bridge cannot support it reliably.

## Result Workbench

The result experience should use three coordinated surfaces.

### Summary Panel
- convergence/result status
- total loss
- iteration count if available
- timestamp
- run mode

### Selected Element Detail
- for buses: voltage magnitude, angle, identity, and key inputs
- for branches: active/reactive flow, loading percentage, status, and key inputs

### Canvas Overlay
- bus voltage state shown with restrained color coding
- branch loading shown with restrained color coding
- switch open/closed state visually distinct
- selected element result emphasized without hiding the whole network

The first stage should optimize for clarity over novelty. The result view must stay readable in an engineering context.

## Error Handling

Avoid `alert`-only flows for critical operational feedback.

Three layers of feedback are required:

### Field Errors
- shown next to the offending input
- updated immediately

### Validation Report
- grouped by severity
- can focus the corresponding element on click
- clearly states whether running is blocked

### Run Failure View
- retains the attempted mode
- shows normalized backend error message
- preserves editability after failure
- offers a clear next action such as "return to findings" or "edit selected item"

## Persistence

First-stage persistence has two durable paths and one lightweight convenience layer.

### Local Draft Autosave
- periodically saves the current topology and ui-safe metadata
- restores the latest unsaved draft on reopen when appropriate

### Explicit Import / Export
- import topology JSON into the normalized store
- export from the normalized store to project JSON

### Recent Run History
- keep a small in-frontend list of recent run summaries
- allow reopening the latest result context
- do not turn this into full project management in stage one

## Testing and Acceptance

This design is complete when these acceptance criteria are met:

1. A user can build a valid topology from an empty canvas using `Bus`, `Line`, `Load`, `Gen`, `DG`, and `Switch`.
2. Every supported element has a complete parameter form with required fields, units, defaults, and validation feedback.
3. Pre-run validation catches and locates common modeling errors before backend execution.
4. Power flow run states are explicit and stable for success and failure paths.
5. Results appear both in the sidebar and on the canvas, with element-level inspectability.
6. Import, export, and autosave draft recovery work reliably.

Suggested verification layers:
- unit tests for data normalization and validation rules
- UI interaction checks for selection, editing, and run gating
- regression checks for JSON import/export stability
- smoke test for end-to-end frontend-to-Julia power flow

## Delivery Plan

Implementation should proceed in bounded slices:

1. Introduce `TopologyStore` and move export/import through it.
2. Separate `CanvasEditor` from parameter and run logic.
3. Implement typed field schemas for the supported element set.
4. Implement immediate validation and pre-run validation report.
5. Wire `RunController` to power flow only.
6. Build `ResultsWorkbench` summary, detail, and canvas highlighting.
7. Add draft autosave and recent run summaries.

Optimization and richer comparison workflows can build on the same structure after the power flow closed loop is stable.

## Risks and Trade-Offs

- Keeping a single-page workbench is faster, but demands disciplined information hierarchy.
- A normalized store adds upfront structure, but greatly reduces state drift and debugging cost.
- Strong run gating improves data quality, but must be paired with precise remediation messages or it will feel obstructive.
- Restricting stage one to power flow closed loop keeps delivery realistic and lowers integration risk.

## Open Questions Resolved In This Design

- Product shape: single-page workbench, not a wizard.
- Priority workflow: empty canvas to power flow result.
- Product bias: engineering correctness over tutorial friendliness.
- Supported first-stage elements: `Bus`, `Line`, `Load`, `Gen`, `DG`, `Switch`.

## Next Step

After user review, convert this design into an implementation plan before any code changes for the new frontend workflow begin.
