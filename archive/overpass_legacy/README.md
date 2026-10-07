<!-- README.md 0.1.4 -->
# Overpass legacy archive

## Why this exists

This folder contains the data from the superseded legacy Overpass pipeline that were used before the UNESCO official-source pipeline was introduced.

On 2026-03-28, the project switched live data loading and CI refresh to `scripts/fetch_unesco_official.ps1` and `data/current/unesco_official_sites.geojson`.

Historical data is retained for traceability and comparison. Local-name tools may consume the data cache; the retired pipeline itself is no longer executed.

Design-rejection rationale is maintained in `Requirements.md` under `Designs considered but not selected` to keep one authoritative copy.

## Archived contents

- The retired `fetch_sites.ps1` and `extract_whs_dataset.ps1` scripts were removed on 7 October 2026; their tracked implementations remain in Git history.
- `data/overpass-legacy-20260328-073941.zip`: Snapshot of former `data/current` Overpass-derived files.

The previously extracted cache and candidate files were removed from this archive because they are recoverable from Git history and the snapshot and were not intended to persist as active project artifacts.


