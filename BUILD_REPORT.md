# Build Report — TraceBox AI

## Upgrade implemented

This cumulative build is the TraceBox AI implementation for SIH26012, built from the confidence-routed + geometry-fixed project and implements the clarified concept:

**Map every house first → find which houses have a problem → send only those problem houses to Surveyor → Supervisor makes the final decision.**

## New functionality

- Expanded deterministic demo area from 5 focal records to **24 house records**
- Full-area AI screening action
- Permanent `H-001`…`H-024` map labels
- Full-area map viewport instead of always zooming only to the selected house
- Satellite imagery is the default context layer
- Screening colors:
  - green: no major issue
  - yellow: needs verification
  - orange: major conflict
  - red: complex case
- Problem-house exception queue in Admin
- Selected-house panel now states the exact problem found
- Surveyor task cards now state the problem found by area screening
- Supervisor queue now carries the area-screening finding into final review
- Clean high-confidence houses bypass Surveyor and go directly to Supervisor
- Only flagged houses receive Surveyor assignments

## Fresh-scan demo distribution

- Total houses: 24
- Direct Supervisor / no major issue: 17
- Targeted verification: 3
- Deep verification: 4
  - Major conflict: 3
  - Complex case: 1
- Surveyor assignments: 7

## Validation actually executed here

- Dependency-independent strict TypeScript compilation of data/types/core services: **PASS**
- TypeScript/TSX parser check across **28 source files**: **0 syntax errors**
- Core every-house workflow validation: **12/12 PASS**

Validated items include:

1. 24 unique houses exist in the area dataset
2. All 24 receive a routing result
3. 17 clean houses go direct to Supervisor
4. 3 houses receive targeted verification
5. 4 houses receive deep verification
6. 17 are classified no-major-issue
7. 3 are classified needs-verification
8. 3 are classified major-conflict
9. 1 is classified complex-case
10. Only 7 houses receive Surveyor assignments
11. PROP-103 still preserves the intended ~76% approximate boundary IoU demo conflict
12. Supervisor-requested recheck of an AI-direct house now receives practical field-verification requirements

## Dependency-backed validation

`npm install` was attempted in this environment but timed out before packages were available. Therefore these are intentionally **not** claimed as passed here:

```bash
npm run typecheck
npm test
npm run build
```

Run them locally before deployment.

## Accuracy limitation

The full-area AI layer is still a deterministic workflow simulation. The house geometries are synthetic metre-scaled polygons and must not be presented as real detections from the Esri/OSM basemap.

The next AI milestone is:

**georeferenced orthomosaic → building segmentation → pixel mask → GeoJSON footprint → area/IoU comparison → confidence routing**, while keeping the current Surveyor/Supervisor workflow unchanged.


## Dense area-screening upgrade
The demo now renders 96 deterministic synthetic house footprints across the analysis extent so the whole-neighborhood workflow can be demonstrated before a real imagery-segmentation model is connected. Permanent H-ID labels appear only at high zoom to keep the satellite map readable. These footprints are workflow simulation data, not claims of real building detection from the basemap.

### Dense full-neighborhood screening validation
- Demo footprint count: 96
- Unique property IDs: 96
- Direct supervisor: 80
- Targeted survey: 9
- Deep survey: 7
- Total surveyor exceptions: 16
- Major conflicts: 6
- Complex cases: 1
- Core TypeScript compilation (data/routing/comparison/confidence): PASS
- Footprint displayed-area consistency: PASS for all 96 synthetic footprints
- Full npm dependency-backed test/build was not run in the build environment because npm install timed out; run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` locally before deployment.


## High-detail surveyor inspection fix
The Surveyor field map now opens directly at zoom 21 around the assigned building footprint, allows zoom up to 22, uses stronger parcel/AI/building strokes, and treats zoom 20+ as inspection-ready. This keeps the GPS dot visible while making the selected house large enough for practical boundary inspection. Zoom improves visual inspection only; imagery accuracy still depends on the source imagery and georeferencing.

## Accuracy / Surveyor Queue Upgrade

- Preserved 96-house synthetic area-screening fallback.
- Added optional live OpenStreetMap building-footprint alignment with automatic fallback.
- Added visible/persisted demo role session so Surveyor switching survives refresh.
- Added Surveyor overview map containing every assigned problem house instead of opening only one isolated house.
- Added high-detail footprint correction controls (1 m north/south/east/west nudge, width/height adjustment, reset).
- Corrected footprint can be attached to field evidence and becomes the field draft seen by the Supervisor.
- Kept Supervisor as the final workflow decision gate.
- No claim is made that synthetic/OSM reference geometry is model-derived or a legal cadastral boundary.

Validation in the build environment:
- 38 TypeScript/TSX source/test files parsed with 0 syntax errors.
- Core non-React TypeScript services type-checked successfully.
- 7/7 dependency-independent geometry/routing checks passed.
- Full dependency-backed `npm run typecheck`, `npm test`, and `npm run build` still need to be run on the user's machine because npm packages are not available in this sandbox.

## Latest corrective build

- Removed the fixed `96 mapped` presentation from the normal pre-analysis flow.
- `Run area analysis` now attempts filtered live building-reference alignment first and uses the returned dynamic house count.
- Added candidate-quality filtering to reject road/highway geometry, roof-only/shed structures, tiny/oversized objects and extreme sliver polygons.
- If the live reference source is unavailable, the app reports the failure instead of silently presenting the synthetic grid as detected houses.
- Added a persistent Surveyor `Submit to Supervisor` action with a clear unlock reason.
- Preserved Admin → Surveyor → Supervisor routing and final human approval.
- Dependency-independent validation: 39 TypeScript/TSX files parsed with 0 syntax diagnostics; core building-filter/routing checks passed.
- Full dependency-backed `npm install` timed out in the build environment; run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` locally before deployment.

## Surveyor submission gate fix

- Geometry corrections no longer invalidate a completed field AI re-analysis. A human footprint adjustment is attached as separate surveyor evidence for Supervisor review.
- The Submit to Supervisor action is now placed after the GPS / re-analysis / evidence controls, with an explicit checklist showing each requirement.
- After submission, the parcel is moved to `SUPERVISOR_REVIEW` and a persistent Surveyor success notice confirms which house was submitted.

## Surveyor precision + submit-gate fix
- Field AI completion is now tracked per house instead of a single reset-prone component flag.
- Switching GPS mode or editing geometry no longer silently clears a completed field re-analysis.
- The final action is always clickable: while requirements are incomplete it explains exactly what remains; once complete it becomes Submit to Supervisor.
- Surveyor geometry now supports draggable per-vertex cyan handles on the high-detail map for irregular roof alignment.
- Coarse move controls were reduced to 0.25 m steps and resize controls to 1% increments.
- A >30% area-change warning helps prevent accidental oversized corrections.
- Original purple footprint remains visible while the cyan field draft is edited.
- 39 TypeScript/TSX source/test files parsed with 0 syntax diagnostics in the build workspace.
- Geometry precision smoke checks passed for single-vertex editing and 0.25 m area-preserving nudges.
- Full npm dependency-backed typecheck/test/build must still be run locally because package installation timed out in the build environment.

## Supervisor field-change trace upgrade
- Surveyor footprint edits are no longer written over the original AI footprint.
- A separate geometry revision is stored with before/after polygons, actor, reason and timestamp.
- Supervisor receives a dedicated before/after map: purple = original AI footprint, cyan = Surveyor correction.
- Supervisor sees area delta, percentage change, changed vertices and maximum vertex movement before deciding.
- Case-level audit history now records field submission and geometry correction details.
- Approval can preserve the reviewed field footprint as the approved workflow footprint without deleting the original AI evidence.

## Supervisor Handoff Trace Fix
- Surveyor submissions now remember the exact last submitted parcel so switching to Supervisor opens that same case.
- Workflow state (parcels, field evidence, geometry revisions, audit entries, selected case) is persisted in localStorage and survives refreshes.
- For field-corrected cases, the Supervisor's primary map is now the before/after comparison: purple = original AI footprint, cyan = Surveyor correction.
- The previous generic GIS map remains only for cases with no submitted geometry correction.
- Source transpile syntax check: 33 TypeScript/TSX files, 0 syntax diagnostics.
- Full dependency-backed typecheck/test/build must still be run locally after npm install.


## Supervisor handoff v4 fix
- Uses a new v4 persisted workflow schema to avoid stale localStorage from earlier prototypes.
- Surveyor submission writes the exact handoff parcel id synchronously.
- Corrected geometry is deep-cloned and stored both in evidence/revision history and on the parcel as `fieldFootprint`.
- Supervisor opens the latest field-submitted house first and renders the before/after comparison as the primary map.

## Field AI re-analysis persistence fix
- Fixed a Surveyor submission-gate defect where field AI re-analysis completion lived only in local component state and could be lost after component remounts/role changes.
- Added `fieldAnalysisCompletedAt` to the parcel workflow record and persisted it in the central parcel context/localStorage.
- `Run field AI re-analysis` now records completion against the exact parcel.
- Geometry edits and role switches no longer clear that completion state.
- Supervisor `REQUEST_CORRECTION` intentionally clears the marker so a fresh field re-analysis is required for a returned case.
- Workflow storage key bumped to v5 to avoid stale localhost state from earlier builds.

## Verification Request Bridge Upgrade

- Added persistent `VerificationRequest` model and service.
- Surveyor submit now creates a request ID (VR-...) linked to the house case and exact evidence ID.
- Supervisor header shows pending/new request indicator.
- Supervisor page includes a Surveyor Request Inbox with NEW/OPENED status.
- Opening a request selects the exact submitted house case and marks the request OPENED.
- Supervisor decisions transition the request to APPROVED / CORRECTION_REQUESTED / ESCALATED.
- Requests persist with workflow state in browser storage (`sih26012-workflow-state-v6`).
- Area reset / new area scan clears old requests.
- Added verification request service tests.

Validation in build environment:
- TypeScript/TSX syntax parse: 35 source files, 0 syntax diagnostics.
- Pure verification request service compile/runtime check: PASS.
- Full dependency-backed `npm install`, `npm test`, and `npm run build` were not completed because dependency installation timed out in the build environment; run them locally before deployment.


## Optional field AI submission update
Surveyor submission no longer requires field AI re-analysis as a hard gate. GPS/location readiness plus required photos and field remarks control submission. Field AI remains available as a recommended comparison signal, and every Verification Request records whether it was completed so the Supervisor can see `COMPLETED` or `NOT RUN`.

### Validation for optional field AI submit change
- Surveyor submit gate now uses only location/GPS readiness + required photos + field remarks.
- Field AI re-analysis is recorded as `COMPLETED` or `NOT RUN` on each Verification Request and displayed to Supervisor.
- Workflow storage bumped to v7 to isolate older localhost state from previous builds.
- 45 TypeScript/TSX source+test files parsed with 0 syntax diagnostics using the TypeScript transpiler.
- Verification Request optional-AI behavior check: PASS.
