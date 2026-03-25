# Frontend Closed-Loop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an engineering-oriented frontend closed loop for `Bus + Line + Load + Gen/DG + Switch`, from empty-canvas modeling through validation, AC power flow execution, and result review in the current PowerJulia UI.

**Architecture:** Keep JointJS and the single-page workbench, but replace the monolithic frontend flow with a modular browser-side app built around a normalized topology store, schema-driven property panel, validation engine, runtime bridge, run controller, and results workbench. Unify Blink and Electron execution paths behind one runtime bridge, and replace the current Electron `call-julia` stub with a real Julia invocation path.

**Tech Stack:** HTML5, CSS3, JointJS, browser ES modules (`.mjs`), Node built-in test runner, Electron IPC, Julia JGDO bridge, OpenSpec change docs.

---

## Planned File Structure

### Modify

- `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
  - Convert the current static shell into a contextual workbench layout with explicit containers for overview, property editing, validation summary, run state, and result detail.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`
  - Add layout, readiness-state, validation, property-panel, and result-workbench styles while preserving the current visual system.
- `D:\workspace\projects\PowerJulia\electron\main.js`
  - Replace the `call-julia` placeholder with a real Julia runner integration and keep existing menu/file actions intact.
- `D:\workspace\projects\PowerJulia\electron\preload.js`
  - Expose the runtime bridge methods needed by the new frontend bootstrap without widening IPC surface area unnecessarily.
- `D:\workspace\projects\PowerJulia\package.json`
  - Add frontend test/smoke scripts and any minimal Node execution helpers needed for plan verification.
- `D:\workspace\projects\PowerJulia\docs\USER_MANUAL.md`
  - Update the user workflow to match the new engineering-first sidebar + validation + results loop.
- `D:\workspace\projects\PowerJulia\README.md`
  - Refresh the frontend run path and smoke-test instructions once the new loop lands.
- `D:\workspace\projects\PowerJulia\test_frontend.html`
  - Turn the current coarse demo page into a closed-loop smoke-test launcher.
- `D:\workspace\projects\PowerJulia\test_parameter_editor.html`
  - Either retire it or refocus it around the new property panel behavior instead of the legacy modal-only flow.

### Create

- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
  - Frontend bootstrap: DOM wiring, store creation, module orchestration, startup restore, and shutdown-safe event binding.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\schema\field-schema.mjs`
  - Element schemas for `Bus`, `Line`, `Load`, `Gen`, `DG`, and `Switch`, including labels, units, defaults, ranges, and required flags.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\state\topology-store.mjs`
  - Single source of truth for topology, selection, validation, run state, history, and draft metadata.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\topology\serializer.mjs`
  - Import/export helpers between store state and the existing JSON topology format.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\canvas\canvas-editor.mjs`
  - JointJS adapter for palette, placement, dragging, links, selection, and canvas overlays.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\property-panel.mjs`
  - Schema-driven sidebar property editor for the currently selected element.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\validation\validation-engine.mjs`
  - Pure validation rules that return structured findings.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\validation-report.mjs`
  - Validation summary/report renderer with click-through navigation to elements and fields.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\runtime-bridge.mjs`
  - Runtime detection and normalized call interface for Blink (`window.Julia`) and Electron (`window.electronAPI.callJulia`).
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\result-normalizer.mjs`
  - Normalization helpers for frontend-friendly power-flow result state.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\run-controller.mjs`
  - Run gating, progress state, backend calls, success/failure handling, and store updates.
- `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\results-workbench.mjs`
  - Summary panel, selected-element result card, and history rendering.
- `D:\workspace\projects\PowerJulia\electron\julia-runner.js`
  - Child-process wrapper that calls Julia safely from Electron.
- `D:\workspace\projects\PowerJulia\scripts\electron_bridge.jl`
  - Minimal Julia entrypoint for Electron that dispatches `run_pf` / `run_reconfiguration_dg` and prints JSON response.
- `D:\workspace\projects\PowerJulia\test\web_ui\field-schema.test.mjs`
  - Unit tests for schema defaults and field metadata.
- `D:\workspace\projects\PowerJulia\test\web_ui\topology-store.test.mjs`
  - Unit tests for selection, mutation, history, and state transitions.
- `D:\workspace\projects\PowerJulia\test\web_ui\serializer.test.mjs`
  - Unit tests for topology import/export round-trips.
- `D:\workspace\projects\PowerJulia\test\web_ui\validation-engine.test.mjs`
  - Unit tests for error/warning findings and run gating.
- `D:\workspace\projects\PowerJulia\test\web_ui\runtime-bridge.test.mjs`
  - Unit tests for runtime detection and call normalization.
- `D:\workspace\projects\PowerJulia\test\web_ui\result-normalizer.test.mjs`
  - Unit tests for frontend result-shape normalization.
- `D:\workspace\projects\PowerJulia\test\web_ui\smoke-manual.md`
  - Manual verification checklist for empty-canvas to result closed-loop behavior.
- `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\proposal.md`
  - Valid OpenSpec proposal for this focused frontend capability.
- `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\design.md`
  - Reference the approved design decisions for OpenSpec workflow.
- `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\tasks.md`
  - OpenSpec task checklist aligned to this implementation plan.
- `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\specs\frontend-closed-loop\spec.md`
  - Requirement deltas for the new frontend capability.

## Chunk 1: Planning Alignment and Frontend Foundation

### Task 1: Align OpenSpec Before Code Changes

**Files:**
- Create: `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\proposal.md`
- Create: `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\design.md`
- Create: `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\tasks.md`
- Create: `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\specs\frontend-closed-loop\spec.md`
- Reference: `D:\workspace\projects\PowerJulia\docs\superpowers\specs\2026-03-25-frontend-closed-loop-design.md`

- [ ] **Step 1: Scaffold a focused OpenSpec change**

Create `add-frontend-closed-loop` instead of trying to reuse the invalid `complete-project-features` change.

- [ ] **Step 2: Write a valid proposal with `Why`, `What Changes`, and `Impact`**

Use this shape:

```md
# Change: Add engineering-oriented frontend closed loop

## Why
The current frontend shell has useful pieces but does not provide a reliable engineering workflow from modeling to power-flow results.

## What Changes
- Add a normalized frontend state/store architecture
- Add schema-driven editing and structured validation
- Add a unified Blink/Electron runtime bridge
- Add result workbench and draft/history behavior

## Impact
- Affected specs: frontend-closed-loop
- Affected code: Resources/web_ui, electron, scripts/electron_bridge.jl
```

- [ ] **Step 3: Add requirement deltas with concrete scenarios**

Include at least:
- modeling from empty canvas
- validation blocking invalid runs
- successful power-flow execution
- element-level result inspection

- [ ] **Step 4: Validate the OpenSpec change**

Run: `openspec validate add-frontend-closed-loop --strict`

Expected: validation succeeds with no formatting errors.

- [ ] **Step 5: Commit only the OpenSpec artifacts**

Run:

```bash
git add openspec/changes/add-frontend-closed-loop
git commit -m "spec: add frontend closed-loop change"
```

### Task 2: Convert the Frontend Entry Point to a Modular Shell

**Files:**
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`

- [ ] **Step 1: Write the failing shell smoke check**

Add a minimal manual smoke note to `test/web_ui/smoke-manual.md` stating that the page must expose:
- palette
- contextual sidebar regions
- disabled/enabled run state area
- results container

- [ ] **Step 2: Run a syntax-only baseline before refactor**

Run:

```bash
node -c D:\workspace\projects\PowerJulia\Resources\web_ui\app.js
node -c D:\workspace\projects\PowerJulia\electron\main.js
```

Expected: both commands pass before the structural split begins.

- [ ] **Step 3: Replace the monolithic HTML bootstrap with a module bootstrap**

Update `index.html` to load:

```html
<script src="vendor/joint.min.js"></script>
<script type="module" src="app/main.mjs"></script>
```

Add stable sidebar subcontainers such as:
- `#workspace-summary`
- `#property-panel`
- `#validation-summary`
- `#run-status`
- `#result-detail`

- [ ] **Step 4: Add the minimal `main.mjs` bootstrap**

Start with a tiny bootstrap that only verifies DOM hooks and logs clear initialization failures.

- [ ] **Step 5: Run shell smoke verification**

Run:

```bash
node --input-type=module -e "import('file:///D:/workspace/projects/PowerJulia/Resources/web_ui/app/main.mjs').then(() => console.log('ok'))"
```

Expected: prints `ok` without import errors.

- [ ] **Step 6: Commit the shell split**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\index.html D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs
git commit -m "refactor: introduce modular frontend bootstrap"
```

### Task 3: Introduce Schema, Store, and Serializer Foundations

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\schema\field-schema.mjs`
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\state\topology-store.mjs`
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\topology\serializer.mjs`
- Create: `D:\workspace\projects\PowerJulia\test\web_ui\field-schema.test.mjs`
- Create: `D:\workspace\projects\PowerJulia\test\web_ui\topology-store.test.mjs`
- Create: `D:\workspace\projects\PowerJulia\test\web_ui\serializer.test.mjs`
- Modify: `D:\workspace\projects\PowerJulia\package.json`

- [ ] **Step 1: Write failing schema/store/serializer tests**

Use Node tests like:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('Bus schema exposes kv as a required numeric field', async () => {
  const { fieldSchemas } = await import('../../Resources/web_ui/app/schema/field-schema.mjs');
  assert.equal(fieldSchemas.Bus.kv.required, true);
  assert.equal(fieldSchemas.Bus.kv.unit, 'kV');
});
```

And:

```js
test('serializer exports a valid empty-base topology shape', async () => {
  const { createTopologyStore } = await import('../../Resources/web_ui/app/state/topology-store.mjs');
  const { exportTopology } = await import('../../Resources/web_ui/app/topology/serializer.mjs');
  const store = createTopologyStore();
  const topology = exportTopology(store.getState());
  assert.equal(topology.meta.baseMVA, 100);
});
```

- [ ] **Step 2: Add a frontend test script**

Update `package.json` with:

```json
"scripts": {
  "test:web": "node --test test/web_ui/*.test.mjs"
}
```

- [ ] **Step 3: Run the new tests and confirm failure**

Run: `npm run test:web`

Expected: failures indicating missing modules/exports.

- [ ] **Step 4: Implement the minimal schema, store, and serializer**

The store must support:
- `getState()`
- `subscribe(listener)`
- `setSelection(kind, id)`
- `upsertNode(node)`
- `upsertLink(link)`
- `setValidation(validationState)`
- `setRun(runState)`
- `pushHistory(summary)`

- [ ] **Step 5: Re-run the focused tests**

Run:

```bash
node --test D:\workspace\projects\PowerJulia\test\web_ui\field-schema.test.mjs
node --test D:\workspace\projects\PowerJulia\test\web_ui\topology-store.test.mjs
node --test D:\workspace\projects\PowerJulia\test\web_ui\serializer.test.mjs
```

Expected: all three pass.

- [ ] **Step 6: Commit the frontend foundation**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app D:\workspace\projects\PowerJulia\test\web_ui D:\workspace\projects\PowerJulia\package.json
git commit -m "feat: add frontend schema store and serializer"
```

## Chunk 2: Editing and Validation Loop

### Task 4: Rebuild Canvas Editing Around the Store

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\canvas\canvas-editor.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`

- [ ] **Step 1: Define the required interaction checklist**

Add to `test/web_ui/smoke-manual.md`:
- add `Bus`
- add `Load`
- add `Gen` or `DG`
- add `Switch`
- connect endpoints
- select and deselect elements
- delete the selected element

- [ ] **Step 2: Move JointJS creation into `canvas-editor.mjs`**

The module should expose:

```js
export function createCanvasEditor({ container, paletteContainer, store, fieldSchemas }) { /* ... */ }
```

- [ ] **Step 3: Wire palette insertion and selection through the store**

Do not let JointJS remain the source of truth. Selection changes should call `store.setSelection(...)`, and node/link creation should call `store.upsertNode(...)` / `store.upsertLink(...)`.

- [ ] **Step 4: Rehydrate the canvas from store state**

`main.mjs` should be able to redraw from current store state after import/restore.

- [ ] **Step 5: Run manual smoke for editing interactions**

Run:
- open `D:\workspace\projects\PowerJulia\test_frontend.html`
- launch the app shell
- verify all checklist items in `test/web_ui/smoke-manual.md`

Expected: no direct editing action requires touching raw JSON.

- [ ] **Step 6: Commit the canvas-store integration**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\canvas\canvas-editor.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\index.html D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css D:\workspace\projects\PowerJulia\test\web_ui\smoke-manual.md
git commit -m "feat: wire canvas editing through topology store"
```

### Task 5: Replace Modal-Only Editing with a Schema-Driven Property Panel

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\property-panel.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`
- Modify: `D:\workspace\projects\PowerJulia\test_parameter_editor.html`

- [ ] **Step 1: Write a failing store-driven property-panel test**

Add a simple data-level test that proves field updates are schema-aware:

```js
test('DG schema exposes p_max_kw and status fields', async () => {
  const { fieldSchemas } = await import('../../Resources/web_ui/app/schema/field-schema.mjs');
  assert.ok(fieldSchemas.DG.p_max_kw);
  assert.ok(fieldSchemas.DG.status);
});
```

- [ ] **Step 2: Confirm the current UI is modal-centric and insufficient**

Manually verify that the current selected element does not persistently expose all required engineering fields in the sidebar.

- [ ] **Step 3: Implement `property-panel.mjs`**

It should:
- read selected element from the store
- render all fields for the selected type
- update store state on change
- show units, defaults, and validation errors inline

- [ ] **Step 4: Update the old parameter-editor test page**

Retarget `test_parameter_editor.html` so it exercises the new sidebar property flow instead of the legacy one-field modal assumptions.

- [ ] **Step 5: Verify the property loop manually**

Checklist:
- select a `Bus`, edit `kv`
- select a `Load`, edit `p_kw` and `q_kvar`
- select a `Switch`, edit `status`
- watch invalid values show inline feedback

- [ ] **Step 6: Commit the property panel**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\property-panel.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\index.html D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css D:\workspace\projects\PowerJulia\test_parameter_editor.html
git commit -m "feat: add schema-driven sidebar property panel"
```

### Task 6: Add Structured Validation and Run Gating

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\validation\validation-engine.mjs`
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\validation-report.mjs`
- Create: `D:\workspace\projects\PowerJulia\test\web_ui\validation-engine.test.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`

- [ ] **Step 1: Write failing validation tests**

Cover at least:
- zero slack buses
- multiple slack buses
- duplicate ids
- disconnected equipment
- invalid line endpoints
- negative impedance

Example:

```js
test('validation blocks topology with no slack bus', async () => {
  const { validateTopology } = await import('../../Resources/web_ui/app/validation/validation-engine.mjs');
  const result = validateTopology(sampleWithoutSlack);
  assert.equal(result.status, 'blocked');
  assert.match(result.findings[0].message, /slack/i);
});
```

- [ ] **Step 2: Run the validation tests and confirm failure**

Run: `node --test D:\workspace\projects\PowerJulia\test\web_ui\validation-engine.test.mjs`

Expected: module/function missing failures.

- [ ] **Step 3: Implement `validation-engine.mjs` as a pure module**

Return a structured object like:

```js
{
  status: 'blocked',
  findings: [
    { severity: 'error', targetKind: 'node', targetId: 'bus-2', field: 'kv', message: '...' }
  ]
}
```

- [ ] **Step 4: Implement `validation-report.mjs` and wire click-through navigation**

The UI must let the user click a finding and focus the corresponding element/field.

- [ ] **Step 5: Verify run gating**

Manual check:
- invalid topology disables or blocks `Run Power Flow`
- fixing the issue transitions the app to `ready_to_run`

- [ ] **Step 6: Commit validation and gating**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\validation\validation-engine.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\validation-report.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\index.html D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css D:\workspace\projects\PowerJulia\test\web_ui\validation-engine.test.mjs
git commit -m "feat: add structured frontend validation"
```

## Chunk 3: Runtime, Power Flow, and Results

### Task 7: Unify Blink and Electron Runtime Bridging

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\runtime-bridge.mjs`
- Create: `D:\workspace\projects\PowerJulia\electron\julia-runner.js`
- Create: `D:\workspace\projects\PowerJulia\scripts\electron_bridge.jl`
- Create: `D:\workspace\projects\PowerJulia\test\web_ui\runtime-bridge.test.mjs`
- Modify: `D:\workspace\projects\PowerJulia\electron\main.js`
- Modify: `D:\workspace\projects\PowerJulia\electron\preload.js`

- [ ] **Step 1: Write failing runtime-bridge tests**

Cover:
- Blink runtime detected when `window.Julia.call` exists
- Electron runtime detected when `window.electronAPI.callJulia` exists
- explicit error when neither bridge exists

- [ ] **Step 2: Implement the frontend runtime bridge**

Expose a small API:

```js
export function createRuntimeBridge(win = window) {
  return {
    mode: 'blink' | 'electron' | 'unavailable',
    call(functionName, payload) { /* ... */ }
  };
}
```

- [ ] **Step 3: Implement `electron/julia-runner.js`**

Spawn Julia using the repo project:

```js
spawn('julia', ['--project=.', 'scripts/electron_bridge.jl', functionName], { cwd: repoRoot })
```

Pass the JSON payload on stdin to avoid shell-escaping issues.

- [ ] **Step 4: Implement `scripts/electron_bridge.jl`**

Read:
- `ARGS[1]` as function name
- `stdin` as topology JSON

Dispatch to:
- `JGDO.run_pf`
- `JGDO.run_reconfiguration_dg`

Print the returned JSON string and exit nonzero on unexpected exceptions.

- [ ] **Step 5: Replace Electron `call-julia` stub**

Update `electron/main.js` so `ipcMain.handle('call-julia', ...)` delegates to `julia-runner.js` and returns parsed/validated JSON to the renderer.

- [ ] **Step 6: Verify both runtimes**

Run:

```bash
node --test D:\workspace\projects\PowerJulia\test\web_ui\runtime-bridge.test.mjs
@'
using JGDO
println("bridge-ready")
'@ | julia --project=. -
```

Expected:
- Node runtime-bridge tests pass
- Julia prints `bridge-ready`

- [ ] **Step 7: Commit runtime bridging**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\runtime-bridge.mjs D:\workspace\projects\PowerJulia\electron\julia-runner.js D:\workspace\projects\PowerJulia\scripts\electron_bridge.jl D:\workspace\projects\PowerJulia\electron\main.js D:\workspace\projects\PowerJulia\electron\preload.js D:\workspace\projects\PowerJulia\test\web_ui\runtime-bridge.test.mjs
git commit -m "feat: unify Blink and Electron Julia bridges"
```

### Task 8: Add a Power-Flow Run Controller

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\result-normalizer.mjs`
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\run-controller.mjs`
- Create: `D:\workspace\projects\PowerJulia\test\web_ui\result-normalizer.test.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`

- [ ] **Step 1: Write failing result-normalizer tests**

Cover at least:
- successful `run_pf` payload normalization
- error payload normalization
- missing bus/branch arrays normalized safely

- [ ] **Step 2: Run the failing tests**

Run: `node --test D:\workspace\projects\PowerJulia\test\web_ui\result-normalizer.test.mjs`

Expected: missing module failures.

- [ ] **Step 3: Implement `result-normalizer.mjs`**

Normalize backend responses into:

```js
{
  summary: { status, lossMw, iter, mode, timestamp },
  buses: [...],
  branches: [...],
  error: null
}
```

- [ ] **Step 4: Implement `run-controller.mjs`**

Behavior:
- pull topology from store
- run full validation
- block if findings contain `error`
- set `running` state
- call runtime bridge with `run_pf`
- store normalized result or normalized error

- [ ] **Step 5: Verify sample run end-to-end**

Run:

```bash
@'
using JGDO
sample = read("examples/sample_topology.json", String)
println(JGDO.run_pf(sample))
'@ | julia --project=. -
```

Expected: JSON with `"status":"ok"`.

Then manually run the frontend and verify:
- invalid topology blocks the run
- valid topology enters `running`
- success populates summary state

- [ ] **Step 6: Commit the run controller**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\result-normalizer.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\runtime\run-controller.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\index.html D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css D:\workspace\projects\PowerJulia\test\web_ui\result-normalizer.test.mjs
git commit -m "feat: add power-flow run controller"
```

### Task 9: Build the Results Workbench and Canvas Overlays

**Files:**
- Create: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\results-workbench.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\canvas\canvas-editor.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\index.html`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css`

- [ ] **Step 1: Define the result inspection checklist**

Add to `test/web_ui/smoke-manual.md`:
- summary shows status and loss
- selecting a bus shows voltage details
- selecting a branch shows flow/loading details
- canvas coloring changes after a successful run

- [ ] **Step 2: Implement `results-workbench.mjs`**

Render:
- overall summary
- bus table / selected-bus detail
- branch table / selected-branch detail
- recent-run summaries

- [ ] **Step 3: Add overlay hooks to `canvas-editor.mjs`**

Support:
- voltage-state coloring on buses
- loading-state coloring on branches
- open/closed switch state emphasis

- [ ] **Step 4: Wire selection-sensitive result detail**

Selecting an element after a run should update the right panel without re-running the calculation.

- [ ] **Step 5: Manually verify the result workbench**

Checklist:
- run sample topology
- click `bus-1`
- click `line-1`
- inspect matching detail cards and canvas overlays

- [ ] **Step 6: Commit the result workbench**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\results-workbench.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\canvas\canvas-editor.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\index.html D:\workspace\projects\PowerJulia\Resources\web_ui\styles.css D:\workspace\projects\PowerJulia\test\web_ui\smoke-manual.md
git commit -m "feat: add frontend results workbench"
```

## Chunk 4: Persistence, Documentation, and Final Verification

### Task 10: Route Import, Export, Autosave, and History Through the Store

**Files:**
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\topology\serializer.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\state\topology-store.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs`
- Modify: `D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\results-workbench.mjs`
- Modify: `D:\workspace\projects\PowerJulia\electron\main.js`
- Modify: `D:\workspace\projects\PowerJulia\test\web_ui\serializer.test.mjs`

- [ ] **Step 1: Write failing persistence/history tests**

Extend `serializer.test.mjs` and `topology-store.test.mjs` to cover:
- export after store mutation
- import restores nodes + links
- autosave snapshot survives round-trip
- run history appends without mutating topology

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
node --test D:\workspace\projects\PowerJulia\test\web_ui\serializer.test.mjs
node --test D:\workspace\projects\PowerJulia\test\web_ui\topology-store.test.mjs
```

Expected: failing persistence/history assertions.

- [ ] **Step 3: Implement store-driven persistence**

Requirements:
- autosave from store state only
- import overwrites current topology state safely
- export serializes current store state only
- history stores run summaries, not full mutable topology references

- [ ] **Step 4: Verify file-path behavior in Electron and browser fallback**

Manual checks:
- export in Electron uses native dialog
- export in browser uses download fallback
- restore loads the latest draft only when schema is parseable

- [ ] **Step 5: Commit persistence and history**

Run:

```bash
git add D:\workspace\projects\PowerJulia\Resources\web_ui\app\topology\serializer.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\state\topology-store.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs D:\workspace\projects\PowerJulia\Resources\web_ui\app\ui\results-workbench.mjs D:\workspace\projects\PowerJulia\electron\main.js D:\workspace\projects\PowerJulia\test\web_ui\serializer.test.mjs D:\workspace\projects\PowerJulia\test\web_ui\topology-store.test.mjs
git commit -m "feat: add frontend persistence and history flow"
```

### Task 11: Refresh Smoke Harnesses and User Documentation

**Files:**
- Modify: `D:\workspace\projects\PowerJulia\test_frontend.html`
- Modify: `D:\workspace\projects\PowerJulia\test_parameter_editor.html`
- Create or Modify: `D:\workspace\projects\PowerJulia\test\web_ui\smoke-manual.md`
- Modify: `D:\workspace\projects\PowerJulia\docs\USER_MANUAL.md`
- Modify: `D:\workspace\projects\PowerJulia\README.md`

- [ ] **Step 1: Update the manual smoke launcher pages**

The launcher pages should point to:
- the new workbench shell
- the property-panel checks
- the closed-loop run checklist

- [ ] **Step 2: Rewrite the user workflow docs**

Document:
- empty-canvas modeling
- field editing in the sidebar
- validation review
- power-flow run
- result inspection

- [ ] **Step 3: Add concise verification commands to README**

Include:

```bash
npm run test:web
node -c Resources/web_ui/app/main.mjs
julia --project=. -e "using Pkg; Pkg.test()"
```

- [ ] **Step 4: Perform the documented smoke test manually**

Follow `test/web_ui/smoke-manual.md` exactly and note any mismatch before proceeding.

- [ ] **Step 5: Commit the smoke/doc refresh**

Run:

```bash
git add D:\workspace\projects\PowerJulia\test_frontend.html D:\workspace\projects\PowerJulia\test_parameter_editor.html D:\workspace\projects\PowerJulia\test\web_ui\smoke-manual.md D:\workspace\projects\PowerJulia\docs\USER_MANUAL.md D:\workspace\projects\PowerJulia\README.md
git commit -m "docs: refresh frontend closed-loop docs and smoke tests"
```

### Task 12: Full Verification and Merge Readiness

**Files:**
- Verify only; no new files required unless fixes are discovered

- [ ] **Step 1: Run all frontend unit tests**

Run: `npm run test:web`

Expected: all `test/web_ui/*.test.mjs` pass.

- [ ] **Step 2: Run syntax checks for the frontend and Electron entrypoints**

Run:

```bash
node -c D:\workspace\projects\PowerJulia\Resources\web_ui\app\main.mjs
node -c D:\workspace\projects\PowerJulia\electron\main.js
node -c D:\workspace\projects\PowerJulia\electron\preload.js
node -c D:\workspace\projects\PowerJulia\electron\julia-runner.js
```

Expected: all commands pass.

- [ ] **Step 3: Run Julia verification**

Run:

```bash
julia --project=. -e "using Pkg; Pkg.test()"
@'
using JGDO
sample = read(\"examples/sample_topology.json\", String)
println(JGDO.run_pf(sample))
'@ | julia --project=. -
```

Expected:
- package tests pass
- sample run prints JSON containing `"status":"ok"`

- [ ] **Step 4: Run the manual closed-loop smoke test**

Checklist must pass end-to-end:
- build topology from empty canvas
- resolve validation findings
- run power flow
- inspect bus/branch detail
- export JSON
- reload and restore draft

- [ ] **Step 5: Review the OpenSpec task list and mark completed items**

Update:
- `D:\workspace\projects\PowerJulia\openspec\changes\add-frontend-closed-loop\tasks.md`

Only mark a box complete when the corresponding implementation and verification really passed.

- [ ] **Step 6: Commit the final verified implementation**

Run:

```bash
git add -A
git commit -m "feat: deliver frontend closed-loop workflow"
```

## Notes for Execution

- Do not start with optimization. Power flow is the acceptance baseline for this milestone.
- Keep the element set constrained to `Bus`, `Line`, `Load`, `Gen`, `DG`, and `Switch`.
- Do not reintroduce a second source of truth in JointJS models. The store owns topology state.
- Prefer pure modules for anything testable in Node.
- Keep the old monolithic `Resources/web_ui/app.js` available only as a temporary migration reference during implementation. Remove dead paths once the new workbench is stable.
- The current `openspec/changes/complete-project-features` entry is invalid and should not be treated as the execution source for this work.
