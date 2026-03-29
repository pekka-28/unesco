<!-- Requirements.md 0.1.8 -->
# UNESCO World heritage GIS requirements

## Product intent

Build a public, reusable UNESCO World heritage dataset and viewer workflow that:

- keeps map hosting on OSM infrastructure with optional uMap interoperability,
- keeps personal visit/travel data under user control,
- avoids paywalls/ad-driven lock-in,
- preserves retired sites rather than deleting them.

## Overarching goal

Provide a practical, user-controlled World heritage companion that keeps UNESCO site data current and transparent, while keeping personal visit data private by default.

## Architecture

Figure 1 shows the end-to-end data and application flow used by the project.

```mermaid
flowchart LR
  D1((UNESCO source data))
  D2((Archived Overpass legacy data))
  D3((Canonical current dataset))
  D4((Extracted WHS dataset))
  D5((User-local profile and visits))

  C1[CI workflow]
  C2[Fetch pipeline]
  C3[WHS extractor]
  C4[uMap template/export path]
  C5[My World Heritage web app]
  C6[uMap user map]

  D1 --> C1
  D2 --> C2
  C1 --> C2
  C2 --> D3
  D3 --> C3
  C3 --> D4
  D4 --> C4
  C4 --> C6
  D4 --> C5
  D5 --> C5
  D5 --> C6
```

Figure 1. My World Heritage data and application architecture.

## Functional requirements

### Dataset and update

- Maintain canonical UNESCO official site dataset with periodic automated refresh.
- Split refresh into staged source load and local conversion steps so conversion always operates on a local file copy.
- Maintain extracted one-record-per-root-WHS dataset for map consumption.
- Use canonical root site identifiers in `WHS <id>` form in converted datasets.
- Maintain generated component-level synthetic sites (`MWH <WHS id>-<nnn>`) for UNESCO multi-location properties while preserving original UNESCO WHS entries unchanged.
- Do not generate synthetic component sites when only one component point exists; keep that case on the root WHS record only.
- Preserve retired/delisted sites with explicit `status`.
- Keep historical snapshots and auditable diffs.
- Keep stable `current` dataset filenames and retain timestamped previous versions in a history store.
- Validate extracted WHS dataset before publication.
- Treat prior Overpass-derived dataset as historical archive only; do not wire it into live application data loading.
- Include extract-status metadata and a note fragment in canonical JSON showing source, count, sizes, most recent data timestamp, most recent attempt timestamp, and retry interval.
- Maintain a reusable local-name mapping table (`data/mappings/local_name_table.json`) keyed by WHS id with `english_name` and curated `local_name`.
- Inject mapped local-name values into published canonical JSON/GeoJSON during every extract conversion.
- Maintain a coverage report (`data/mappings/local_name_coverage.json`) showing proportion of WHS roots with mapped local names.
- Maintain a jurisdiction language policy table (`data/mappings/jurisdiction_language_policy.json`) keyed by jurisdiction ISO code with capped language-script selectors.
- Maintain a jurisdiction-language anomaly report (`data/mappings/jurisdiction_language_policy_anomalies.json`) for review of over-cap official-language sets.
- Include input-source fingerprints in jurisdiction policy outputs so deterministic runs can be verified for fixed inputs.
- Use default jurisdiction selector cap of 4 (not 3), based on observed material losses at cap 3 (including Switzerland and Fiji official-selector coverage).
- Provide a separate update exercise/script that proposes mapping-table updates from UNESCO/Overpass sources, with optional Wikipedia fallback and strict confidence gating before apply.
- Provide an on-demand CI workflow for local-name maintenance that runs the update/coverage scripts and can optionally apply only high-confidence mapping updates.

### Mapping and interaction

- Show UNESCO sites from local dataset with stable identifiers.
- Show both root WHS entries and component synthetic entries, and allow users to use either grouped (root) or per-location (component) recording.
- Group high-volume component synthetic entries into a dedicated `Multiple sites` list mode using a configurable threshold.
- Exclude high-volume component synthetic entries from the default `All sites` list so they do not dominate standard browsing.
- Hide high-volume component markers by default on map redraw, and reveal them when visited, searched, or explicitly selected.
- Show site detail on selection; hide detail when nothing is selected.
- Clicking map background clears current selection.
- Site title links to UNESCO page for narrative text.
- Criteria are shown as linked tokens with tooltips.
- Hover tooltip shows site name.
- For synthetic component sites, use the component/sub-site name as the primary display name (avoid repeating the root-site summary in the title).
- Use curated local-name mapping values as supplementary native-script text in tooltip/detail.
- Do not auto-display UNESCO translation columns as local-script names unless they are explicitly curated into the mapping table.
- Visit status is constrained to: not visited, visited, pending, won't visit.
- Visited sites render in distinct colour from non-visited sites.
- Double-click on a site toggles visited and not visited.
- Site detail supports a per-site visit log with date, status, and note entries.
- Component visits and root WHS visits are recorded separately by site identifier.
- Users can create, edit, and delete multiple dated visit entries for the same site.
- Root WHS detail indicates when the WHS contains multiple individual component sites.
- Site list presents `Site` and `Visited` columns with header-driven sorting.
- Site-list mode includes an explicit blank/no-list option so users can hide the list pane without changing selection state.
- Site tooltip supports multiline display for long component names, with a clear component separator glyph.
- Initial load fits WHS bounds; subsequent loads restore prior viewport.
- Site identifier (WHS id) is shown only in the detail pane in de-emphasised form.
- Snapshot action captures a map image for sharing (clipboard image copy when supported, otherwise file download).
- Summary action exports a static HTML report with a world-map image of visited sites and a visited-sites table.
- Show a visible loading indicator during data load and other long-running user actions.

### Search

- Unified search supports both:
- WHS site search by id/name.
- Geographic place search via geocoding.
- Search renders selectable result list entries.
- Search runs on explicit user request from search control.
- Home-location search presents selectable list results with canonical place naming.
- Search updates the right-side site list immediately when requested.
- Changing site-list mode immediately refreshes the right-side list.
- If web geocoding is unavailable, local WHS metadata text matching still returns site results.
- If WHS direct text matching is empty but geocoding resolves a region, sites in the resolved bounding box are listed.

### Profile and session

- First-run enrolment is distinct from Settings and initializes user identity/home location.
- Use local profile only (no backend dependency).
- Include schema version in profile and verify on load/import.
- Include import/export for migration between systems.
- Include visit-log data in import/export payloads.
- Support import mapping from legacy personal-layer data carrying `date`, `note`, `status`, and `ref_whc`.
- Logout disconnects current page session from local profile.
- Connect performs current silent reconnect from local store.

### Settings

- Settings includes:
- user name,
- home location search + select + use-my-location,
- separate from enrolment flow,
- visited-only filter,
- usage-summary reminder controls (`interval days` or `none`).
- date display format selector (`y-m-d`, `d-m-y`, `m-d-y`) while stored entry values remain `YYYY-MM-DD` or `YYYY-MM`,
- length units selector (`kilometres` or `miles`).
- multiple-sites threshold setting (default `5`) controlling when component entries move into `Multiple sites`.
- Home location search uses selectable list (combo-style), not button-per-result.
- If one canonical match is selected, subsequent search confirms that selection.

### Interface localisation (pending)

- Add an interface-language setting in Settings (default `English`).
- Keep UNESCO canonical dataset structure unchanged; localisation targets interface text and formatting, not source dataset identity keys.
- Prefer curated local-script site labels when available for the selected interface language/script, while retaining English as the universal fallback handle.
- Support locale-aware date and number rendering in UI while preserving canonical stored date forms.
- Treat localisation delivery as optional resource bundles that can be extended by contributors.

### Usage summary and census (pending integration)

- Request startup consent for periodic pseudonymised summary prompt.
- Default reminder interval: 7 days; user can change interval or set none.
- Allow submission without requiring each user to have a GitHub account.
- Summary includes:
- date,
- use count since last summary publication,
- visited site count,
- dataset magic cookie.
- Support an optional anonymous form/endpoint URL in Settings for direct summary submission.
- Keep clipboard/manual fallback when endpoint submission is unavailable.
- Provide a periodic owner digest email path from collected summaries.
- Backend encouragement message reports active users and average visited sites in the configured window.
- Record coarse per-load census counter without detailed telemetry.
- Note that counts are approximate due to abandoned sessions, multi-device use, and repeated use.
- Distance display in nearby-site suggestions is deferred until locale-sensitive formatting/unit strategy is defined.

## Data storage requirements

- Site catalog data is stored in a canonical repository JSON file, with GeoJSON generated as a derived map-consumption artifact.
- User profile and usage counters are stored in browser localStorage.
- Logout state is in-memory for the current page only; no separate browser session-storage key is used.
- Personal/private artifacts must remain excluded from commits.

## Source and licensing requirements

- UNESCO pages are authoritative for official listing/narrative references.
- OSM/Wikidata may provide geometry/linkage.
- Narrative text should be linked, not republished wholesale, unless license permits.
- Attribution must be present for all data sources.

## OSM support requirements

- Provide tooling/docs to identify missing or ambiguous OSM linkage (`ref:whc`).
- Generate review lists to support optional human OSM improvements.

## Publication requirements

- Publish artifacts and docs via GitHub/GitHub Pages.
- Use the custom My World Heritage viewer as the primary operational application.
- Keep uMap as an optional seed/export interoperability path, not the primary runtime.
- Enable users to keep private data privately and optionally share selected fragments.
- Provide a reproducible local workflow for refresh, extraction, validation, and optional uMap template interoperability.

## Designs considered but not selected

- Legacy Overpass-derived WHS ingestion as live source:
- reason not selected: region-partitioned live Overpass queries were operationally fragile and caused incomplete or delayed map loads.
- reason not selected: partitioning introduced overlap/gap risk and required manual tuning of region boundaries.
- reason not selected: coverage and authority were insufficient for canonical UNESCO maintenance.
- selected replacement: UNESCO official-source ingestion with deterministic local conversion and validation.
- historical note: only the packaged legacy snapshot and scripts are retained in `archive/overpass_legacy/` for traceability.
- Manual per-site status as primary source of truth:
- reason not selected: superseded by visit-log-first model where status is derived from recorded visits.
- Search-on-typing as primary interaction:
- reason not selected: replaced with explicit search-trigger behaviour for predictable updates.
- Detailed usage-summary payload (visited/inspected counts and duration):
- reason not selected: replaced by minimal usage-interest summary (`use count since last push`, `visited site count`, date, magic cookie).

## Non-goals and deferred items

- Advertising support.
- Mandatory-auth hosted platform for public core dataset.
- Public social review features.
- Full transport-network route reconstruction.
- Locale-sensitive distance display strategy for nearby-site labels.
- Direct automated push of usage summaries to GitHub without explicit user action.
- UNESCO official-list scraper integration replacing Overpass bootstrap source (pending legal/licensing/format review).
- Manual local-file import fallback for UNESCO extract refresh.
- Comprehensive locationation support.

## Specifications

This section provides concrete implementation specifications for the site and backend script. Table 1 anchors the user-facing controls used in the site.

### Site specification

- Runtime: single-page HTML application in `site/index.html`, served as a static GitHub Pages site.
- Map stack: Leaflet + OpenStreetMap tiles.
- Search stack: local WHS text match plus optional Nominatim geographic search.
- Persistence model: browser `localStorage` for profile/visits/settings/counters; in-memory logout state for current page.
- Dataset load: `data/current/unesco_official_sites.geojson` (map), with extract metadata from `data/current/unesco_official_sites.json`.
- Submission flow: manual and periodic usage summary submission dialog with endpoint POST and clipboard fallback.

Table 1. User interface elements and purpose.

| User interface element | Purpose |
| --- | --- |
| Application title (`My World Heritage`) | Opens the help and dataset status dialog. |
| Search box + magnifier | Runs explicit site/place search and updates result list. |
| Search results list | Lets the user choose a matched site or place result. |
| Snapshot button | Captures and copies/downloads current map image. |
| Site list selector | Switches right-side list mode (`All`, `Multiple`, `Visited`, `Searched`, blank). |
| Map markers | Show WHS/site points with visited-aware styling and selection. |
| Site detail pane | Shows selected site details and visit log editor. |
| Visit log editor | Adds/edits/deletes dated visit entries with status and note. |
| User menu | Accesses connect/settings/export/import/summary/submit/reset/logout actions. |
| Settings dialog | Edits profile, filters, formatting, thresholds, and submission settings. |
| Enrolment dialog | First-run setup for user identity and home location. |
| Usage summary inbox icon | Appears when periodic submission is due. |
| Usage summary dialog | Shows payload summary, submit state, and backend encouragement message. |
| Loading indicator | Signals active load/long-running map operations. |

#### Search control

- Search runs on explicit action (magnifier or Enter), not on every keystroke.
- A single WHS match recentres the map to that site and updates `Searched sites`.
- Geographic matches are selectable and can seed WHS matches by bounding box.

#### Site list and detail panes

- The right pane hosts either list mode output or selected-site detail.
- List header sorting is in-place (`Site`, `Visited`) and remains visible during scroll.
- Selecting map background clears site detail and keeps list state consistent with current list mode.

#### Visit log editor

- Date entry accepts `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.
- Status values are constrained to `visited`, `pending`, `won't visit`, `not visited`.
- Double-clicking a marker toggles visited/not visited without opening the editor.

#### Usage summary flow

- Startup prompt asks for opt-in once per profile.
- During active use, due reminders show a mailbox icon instead of interrupting map flow.
- Submission dialog handles success, duplicate, deferred confirmation, and clipboard fallback states.

### Backend script specification

The Apps Script backend in `backend/usage_summary_backend/google_apps_script/Code.gs` provides ingest, aggregate stats, and owner digest support. Table 2 anchors callable interfaces.

Table 2. Backend interfaces and purpose.

| Interface | Purpose |
| --- | --- |
| `doGet` | Health response and aggregate stats response (`?stats=1`). |
| `doPost` | Validates payload and appends usage summary rows. |
| `buildRecentStats_` | Computes windowed active users and average visited sites. |
| `sendPeriodicDigest` | Sends owner digest email from recent workbook rows. |
| `backendSelfTestDryRun` | Validates workbook/token wiring without row insert. |
| `backendSelfTestAppend` | Inserts one controlled test row for verification. |
| `installDailyDigestTrigger` | Creates daily trigger for digest function. |
| `enforceWorkbookBinding_` | Restricts writes to configured workbook id/name. |

#### Backend aggregate metrics

- Active users: unique `magic_cookie` values in the configured stats window.
- Average visited sites: average of each active user’s latest `visited_site_count` in that window.
- Encouragement text is backend-generated so wording/window policy is centrally controlled.

#### Backend settings guidance (soft dependencies)

- Set `MWH_STATS_WINDOW_DAYS` to approximately `2 x MWH_REPORT_DAYS` so in-app encouragement reflects a broader window than owner digest cadence.
- Keep `MWH_DUPLICATE_TTL_SECONDS` greater than or equal to `MWH_MIN_INTERVAL_SECONDS` to avoid duplicate suppression gaps.
- Keep `MWH_MAX_SUBMISSIONS_PER_COOKIE_PER_HOUR` above expected legitimate retry volume but low enough to damp scripted burst traffic.

## Localisation implementation details (pending exercise)

This section records the investigation outcome and a practical contribution path for an interested contributor.

### Scope and complexity summary

- Estimated effort for a first practical cut: medium (roughly 2 to 4 focused days).
- Primary complexity is UI text extraction, runtime language switching, and preserving existing behaviour across dialogs and map/list flows.
- UNESCO dataset ingestion does not need to be localised for phase 1.

### Recommended implementation approach

1. Introduce resource bundles:
- Add `site/i18n/en.json` as baseline.
- Add one additional bundle (for example `fr.json`) to validate structure and fallbacks.

2. Add runtime i18n service in SPA:
- Add `t(key, params)` helper with fallback to English.
- Add `setLanguage(langCode)` and persist selected language in profile settings.

3. Externalise user-facing strings:
- Move menu labels, dialog labels, button text, validation messages, status messages, and tooltips into bundle keys.
- Keep telemetry payload keys and dataset field names unchanged.

4. Localise formatting:
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat` for display-only rendering by selected language.
- Keep stored visit-date values canonical (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`).

5. Site-name display strategy:
- Keep English site name as primary handle.
- Show curated local-script name as supplemental line when it matches selected language/script policy.
- Avoid duplicate render where local and English forms are equivalent.

6. Testing and acceptance:
- Verify language switch across enrolment, settings, detail pane, help, and usage-summary dialog.
- Verify no regression in search, visits, export/import, or usage-summary submission.

### Suggested pull request exercise

- Suggested PR title: `Add interface localisation framework and language setting`.
- Suggested PR scope:
- add i18n bundles (`site/i18n/en.json`, one additional language),
- add i18n runtime helper and language setting wiring,
- migrate high-visibility UI strings first (menus, settings, help, submit dialog),
- document contributor workflow for adding a new language bundle.

## Acceptance criteria

- Data refresh pipeline remains reproducible and reliable.
- WHS layer loads without frequent remote runtime failures.
- Personal data is not committed by default.
- Settings and profile lifecycle functions work without backend support.
- Requirements stay synchronized with implemented feature set.


