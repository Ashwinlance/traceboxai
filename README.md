# TraceBox AI

**AI-Assisted Urban Parcel Mapping & Human Verification Platform — SIH26012**

**Tagline:** Map. Verify. Trace. Approve.

A Smart India Hackathon MVP implementing the refined workflow:

**Drone/orthomosaic area → AI marks every visible house → compare each house with GIS/reference data → identify problem houses → confidence-based routing → surveyor verifies only exceptions → supervisor makes the final decision → approved GIS state.**

> Important: this prototype detects physical evidence and inconsistencies. It does **not** determine legal ownership, declare encroachment/illegality, or replace authorized cadastral/legal processes.

## Main concept implemented

The Admin starts from an **area-wide screening pass**, not one property at a time. `Run area analysis` loads the currently available building-reference polygons for the demo area, filters likely house footprints, assigns `H-xxx` case IDs, calculates comparison/confidence results, and splits the area into:

- **No major issue** → very-high-confidence clean draft → direct Supervisor review
- **Needs verification** → uncertain / not-observable evidence → targeted Surveyor verification
- **Major conflict** → material geometry/record difference → deep Surveyor verification
- **Complex case** → multi-parcel/complex geometry evidence → deep Surveyor verification before Supervisor can escalate

The mapped-house count is **dynamic when live building-reference data is available**. A 96-house synthetic fallback remains only for offline/demo continuity and is not presented as imagery-derived AI detection.

## Map behavior

### Admin area view

- Satellite imagery is the default context layer
- Every demo house gets an `H-xxx` ID
- Green = no major issue
- Yellow = needs verification
- Orange = major conflict
- Red = complex case
- Clicking any house selects it and shows the exact configured issue, area, confidence, IoU and route
- Existing GIS and AI candidate boundary details are shown in the selected-house inspection view

### Surveyor field view

Surveyors receive only AI-flagged houses. The field workflow includes:

- Assigned problem-house queue
- Blue current GPS/demo-location dot
- High-detail map with satellite/street/terrain layers
- Location + zoom readiness gate
- Field AI re-analysis simulation
- Confidence-specific evidence minimums
- Photos, GPS timestamp, duration and remarks
- Deep-verification boundary review
- Submission to Supervisor

### Supervisor

Supervisor receives:

- **AI DIRECT** clean high-confidence houses that bypass field survey
- **FIELD VERIFIED** houses with surveyor evidence

Supervisor can approve, send back to Surveyor, or escalate. AI never performs final cadastral/legal approval.

## Important accuracy boundary

The current `aiEngine.ts` is still a deterministic MVP simulation. The 24 polygons are synthetic, metre-scaled demo geometries used to prove the workflow **map every house → find problems → solve only exceptions**.

They are not claimed to be imagery-derived detections. For production accuracy, replace the AI service with a segmentation/footprint pipeline operating on properly georeferenced high-resolution drone/orthomosaic imagery, then convert masks to GeoJSON and compare them with authorized cadastral/GIS data and GNSS ground truth.

## Run locally

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

## Recommended demo

1. Admin → `Run area AI mapping`.
2. Show the full map: every house has an `H-xxx` label and screening color.
3. Open the problem-house queue.
4. Select `H-003 / PROP-103` → show the 120 m² vs 165 m² conflict and deep-verification route.
5. Surveyor → open the flagged house → use demo/device GPS → zoom ≥19 → run field AI re-analysis → submit evidence.
6. Supervisor → compare AI/reference/field evidence → approve, send back or escalate.
7. Return to Admin → approved geometry and audit history are visible.

## Technology

- React + TypeScript + Vite
- Leaflet / React-Leaflet
- Deterministic service-layer AI simulation
- Role-based Admin / Surveyor / Supervisor workflow
- Explainable confidence and exception routing


## Dense area-screening upgrade
The demo now renders 96 deterministic synthetic house footprints across the analysis extent so the whole-neighborhood workflow can be demonstrated before a real imagery-segmentation model is connected. Permanent H-ID labels appear only at high zoom to keep the satellite map readable. These footprints are workflow simulation data, not claims of real building detection from the basemap.


## High-detail surveyor inspection fix
The Surveyor field map now opens directly at zoom 21 around the assigned building footprint, allows zoom up to 22, uses stronger parcel/AI/building strokes, and treats zoom 20+ as inspection-ready. This keeps the GPS dot visible while making the selected house large enough for practical boundary inspection. Zoom improves visual inspection only; imagery accuracy still depends on the source imagery and georeferencing.

## Accuracy + Surveyor Workflow Upgrade

This cumulative build adds three safeguards/improvements requested during field-flow testing:

1. **Surveyor role/session reliability** — the selected demo role is persisted in `localStorage`, the active demo user is visible in the header, and the Surveyor portal can prepare assignments if the Admin scan has not yet been routed.
2. **All assigned houses on the Surveyor map** — Surveyor mode now opens with an overview map of every flagged house. Selecting a footprint opens the high-detail inspection workflow for that house.
3. **Geometry alignment workflow** — Surveyors can nudge a detected footprint by 1 metre and adjust width/height before submitting a corrected field draft to the Supervisor. The original AI outline remains visible for comparison.

### Optional live-aligned building footprints

The Admin portal includes **Align to live map buildings**. It requests OpenStreetMap building geometry for the fixed demo area through the public Overpass API and uses those building polygons to visually align the prototype screening footprints. This makes the map substantially more realistic than the synthetic grid when the network/API is available.

Important: OpenStreetMap geometry is used only as a **prototype visual/reference bootstrap**. It is not AI inference, not a cadastral parcel record, and must not be presented as legal boundary evidence. The production path remains georeferenced drone/orthomosaic imagery -> segmentation -> GeoJSON -> authorized GIS/GNSS comparison -> human review.

If Overpass is unavailable, the 96-house synthetic demo remains available and the rest of the workflow continues to function.

## Latest accuracy / submission correction

The normal **Run area analysis** path no longer presents the fixed 96-house synthetic grid as detected houses. It first loads building polygons from the live OpenStreetMap building reference, applies a likely-house geometry filter (rejecting highway/road geometry, roof-only structures, sheds, tiny/oversized candidates and extreme sliver polygons), then screens the resulting dynamic set. The mapped-house count therefore comes from the current live reference result rather than a fixed demo total.

This improves visual alignment for the MVP, but it is still **reference-assisted prototype geometry, not computer-vision inference and not legal cadastral geometry**. A production version should replace this reference alignment with segmentation on georeferenced orthomosaic/drone imagery and validate against authorized GIS/GNSS data.

The Surveyor workspace keeps a prominent **Submit to Supervisor** action visible as a sticky field-action card. Submission requires the configured location/GPS condition, required photos, and remarks. Field AI re-analysis is optional and its status is recorded for Supervisor review.

### Surveyor submission flow

For a flagged house: verify location, add the required evidence/remarks, optionally run field AI re-analysis, optionally correct the footprint, then use **Submit to Supervisor**. The verification request records whether field AI was completed or skipped, so Supervisor review remains transparent.

### Surveyor precision editing
In Surveyor mode, drag the numbered cyan vertex handles directly on the high-detail map to align the working footprint with visible roof corners. The purple outline remains the original AI/reference-aligned footprint. Use 0.25 m nudge and 1% resize controls only for small whole-footprint adjustments. The submit gate reports missing GPS/evidence/remarks requirements; field AI re-analysis remains optional.

### Supervisor change trace
Surveyor corrections are preserved as separate revisions instead of replacing AI evidence. In Supervisor mode, open a field-verified case to compare the original AI footprint (purple) against the Surveyor correction (cyan), review numeric geometry deltas and field evidence, then approve, return for correction, or escalate.

### Supervisor field-change handoff
When a Surveyor edits and submits a footprint, switch to **Supervisor**. The app now opens the exact last submitted house automatically. The first map for that case shows the immutable AI footprint in purple and the Surveyor correction in cyan, followed by numeric change metrics and the case audit trail. Workflow state is persisted locally so a browser refresh does not erase the handoff.

## Verification Request / Supervisor Inbox workflow

Surveyor submissions now create an explicit `VerificationRequest` instead of relying only on screen state. Each request references one authoritative parcel/house case and the exact field evidence object that created it.

Flow:

`Surveyor field verification -> Submit -> Verification Request (NEW) -> Supervisor inbox indicator -> Open request -> Review exact house/evidence/geometry -> Approve / Request correction / Escalate`

Request states: `NEW`, `OPENED`, `APPROVED`, `CORRECTION_REQUESTED`, `ESCALATED`.

The request is a notification/handoff pointer, not a duplicate legal parcel record. The parcel case, AI geometry, field geometry, evidence and workflow status remain authoritative in the central workflow store.


## Optional field AI submission update
Surveyor submission no longer requires field AI re-analysis as a hard gate. GPS/location readiness plus required photos and field remarks control submission. Field AI remains available as a recommended comparison signal, and every Verification Request records whether it was completed so the Supervisor can see `COMPLETED` or `NOT RUN`.

## Live building-reference resilience
TraceBox AI does not silently fall back to the old synthetic 96-house grid. The live building-reference loader now tries the TraceBox same-origin `/api/overpass` proxy first (used on Vercel) and then multiple public Overpass mirrors with per-request timeouts. If all sources fail, the UI reports a retryable network/reference-service error instead of presenting fake detected houses.
