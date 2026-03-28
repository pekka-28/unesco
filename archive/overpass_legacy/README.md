# Overpass legacy archive

## Why this exists

This folder contains the superseded legacy Overpass pipeline and data that were used before the UNESCO official-source pipeline was introduced.

On 2026-03-28, the project switched live data loading and CI refresh to `scripts/fetch_unesco_official.ps1` and `data/current/unesco_official_sites.geojson`.

The artifacts here are retained only for traceability and historical comparison. They are not wired into the live application or CI update path.

Design-rejection rationale is maintained in `Requirements.md` under `Designs considered but not selected` to keep one authoritative copy.

## Archived contents

- `scripts/fetch_sites.ps1`: Overpass regional fetch script (legacy source).
- `scripts/extract_whs_dataset.ps1`: Extractor for the Overpass-derived legacy dataset.
- `data/overpass-legacy-20260328-073941.zip`: Snapshot of former `data/current` Overpass-derived files.

The previously extracted cache and candidate files were removed from this archive because they are reproducible from scripts/snapshot and were not intended to persist as active project artifacts.
