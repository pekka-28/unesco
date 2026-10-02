<!-- README.md -->
# Supabase preview

Open [My World Heritage — Supabase preview](https://pekka-28.github.io/unesco/site-supabase/?submit=1) in the browser used for the existing site. This preview shares its local profile and visit history with `/unesco/site/`, as requested by the owner. Use Connect from the user menu if needed. A new browser profile opens enrolment instead.

The preview always sends monitoring summaries to the deployed Supabase endpoint, including when a saved profile specifies Google Sheets. Names, locations, individual visits and notes remain in the browser. The Submit menu sends the current usage summary; visiting or saving a site does not itself send a summary.

The preview uses the shared `data/current/` catalogue. It is a separately published build of the prepared application on 2 October 2026. The existing site remains available at its original address. Reload when switching between the two versions so each reads the latest shared profile; simultaneous edits in stale tabs can overwrite one another.
