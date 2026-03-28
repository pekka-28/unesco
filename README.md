# My World Heritage

Public, user-controlled UNESCO World heritage mapping with a custom web viewer and reproducible dataset refresh tooling.

## Project goal

Maintain a current, transparent UNESCO site catalogue for mapping, while keeping personal visit data private by default and under each user's control.

## What is primary now

- Primary runtime: custom viewer at `site/index.html` (served over HTTP).
- Dataset source: UNESCO official export converted into project JSON/GeoJSON.
- uMap role: optional seed/export interoperability, not the primary live application path.
- Overpass role: historical legacy archive only (`archive/overpass_legacy/`), not live data.

## Key repository paths

- `site/`: custom viewer application.
- `data/current/unesco_official_sites.json`: canonical dataset read by tooling and app metadata UI.
- `data/current/unesco_official_sites.geojson`: derived map format used by the viewer.
- `data/history/`: timestamped retained versions.
- `scripts/`: fetch, conversion, validation, and local-name maintenance tooling.
- `.github/workflows/`: CI workflows for data refresh and mapping maintenance.
- `Requirements.md`: product intent and requirements baseline.

## Local preview

Do not open with `file://`. Serve via HTTP:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080/site/`.

## Local data refresh

```powershell
$env:UNESCO_SOURCE_URL="https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json"
./scripts/fetch_unesco_official.ps1 -SourceUrl $env:UNESCO_SOURCE_URL -RawOutputFile "data/staging/unesco_source_raw.txt"
./scripts/convert_unesco_source.ps1 -InputFile "data/staging/unesco_source_raw.txt" -SourceUrl $env:UNESCO_SOURCE_URL -OutputJsonFile "data/current/unesco_official_sites.json" -OutputFile "data/current/unesco_official_sites.geojson" -ArchiveDir "data/history" -KeepVersions 24 -RetryIntervalDays 30 -OverwriteExisting
./scripts/validate_whs_dataset.ps1 -InputFile "data/current/unesco_official_sites.json"
./scripts/validate_whs_dataset.ps1 -InputFile "data/current/unesco_official_sites.geojson"
```

For local-name enrichment, run the mapping scripts in `scripts/` and see workflow details in `.github/workflows/local-name-maintenance.yml`.

## Script reference (brief)

No single runner is used; CI stays split by workflow purpose.

- `fetch_unesco_official.ps1`: download UNESCO source to local staging file.
- `convert_unesco_source.ps1`: convert staged source to canonical JSON and derived GeoJSON; rotate `data/history`.
- `validate_whs_dataset.ps1`: validate JSON or GeoJSON dataset shape.
- `update_extract_status.ps1`: update extract-status metadata after attempts/failures.
- `fetch_cldr_support.ps1`: fetch CLDR inputs used for language-script policy.
- `build_jurisdiction_language_policy.ps1`: build jurisdiction language/script selector policy and anomaly report.
- `update_local_name_table.ps1`: propose/apply local-name table updates with confidence controls.
- `build_local_name_table_from_policy.ps1`: rebuild local-name table constrained by jurisdiction policy.
- `check_local_name_coverage.ps1`: compute mapped local-name coverage report.
- `build_native_name_map.ps1`: build native-name map artifact from source plus mapping inputs.
- `backup_current_whs.ps1`: legacy helper for backing up `whs_sites_used.geojson` (not used by current CI path).

## Legacy archive

`archive/overpass_legacy/` contains retained historical Overpass-era material for traceability only. Reasons for rejecting that design are documented in `Requirements.md` under `Designs considered but not selected`.
