<!-- GITHUB_DEPLOYMENT.md -->
# Supabase deployment through GitHub

[Issue #6](https://github.com/pekka-28/unesco/issues/6) tracks the transition to the native Supabase GitHub integration. The project is `fjqhgcegnphavatrchjb`; the repository is `pekka-28/unesco`.

# Activation status

The native GitHub connection was verified on 2 October 2026: repository `pekka-28/unesco`, working directory `.`, production branch `main`, and automatic preview branching disabled. Supabase recognises `main` as the default production branch. Release and endpoint verification evidence is recorded in Issue #6. Routine CLI deployment is retired; backend changes are released through GitHub.

# Connection settings

In [project integrations](https://supabase.com/dashboard/project/fjqhgcegnphavatrchjb/settings/integrations), authorise Supabase's GitHub integration if prompted, select `pekka-28/unesco`, set the working directory to `.`, and select `main` as the production branch. Enable **Deploy to production**. Leave **Automatic branching** off; no paid preview environments are required.

Supabase's GitHub authorisation is separate from the token used by `gh` and from the Supabase CLI login. Existing grants may be reused if the dashboard offers them. Keep production credentials in Supabase Secrets and Vault; do not copy them into GitHub or commit them.

# Change and release process

Errors and reported anomalies follow the process below. Documentation improvements use a pull request directly and do not require an Issue.

1. Create a GitHub Issue with the observed behaviour and acceptance criteria.
2. Implement the fix on a branch. Commit each schema change as a new migration script; do not rewrite applied migrations. Update functions and schema traceability together.
3. Open a linked pull request and pass the repository checks. Preview branching is disabled, so local database tests do not represent a hosted preview.
4. Merge reviewed changes to `main`. Supabase applies pending migrations and deploys the functions declared in `supabase/config.toml`. GitHub Pages independently publishes the canonical browser distribution.
5. Check Supabase's deployment result and the public service/histogram endpoints. For a reporting change, verify the relevant behaviour without generating unnecessary user alerts.
6. Record deployment and validation evidence in the Issue, then close it. Do not use automatic issue-closing keywords in a PR when closure must wait for deployment verification.

# Deployment scope

All three active Edge Functions are explicitly enabled with their entrypoints in `config.toml`: `usage-summary`, `new-profile-notifications` and `monthly-report`. Their existing JWT settings are retained. Private mail endpoints continue to enforce their worker credential in application code. Database migrations retain the reporting tables, grants and retry scheduler.

The integration deploys new migrations and declared Edge Functions and Storage buckets. Other configuration areas, including Auth/API settings and production seed data, are not automatically applied by default. Existing mail credentials and Vault values remain operational state rather than repository contents. This switch does not enable the currently inactive monthly schedule.

# Retired deployment procedure

Manual `supabase db push` and `supabase functions deploy` commands are retired as the routine release process. Earlier setup commands remain available in Git history as deployment evidence. The installed CLI and historical setup/diagnostic scripts need not be deleted: they are excluded from the web distribution and may be retained for explicitly approved recovery work. Do not run those scripts as an alternative production release path.

# Recovery

A failed integration deployment keeps the Issue open. Inspect its logs and correct the cause in a new PR. Applied database migrations are not undone by reverting Git; write a forward corrective migration. A reverted function change still needs a successful deployment. Use the Supabase dashboard for operational diagnostics and secret management. Coordinate any exceptional manual recovery explicitly.

# References

1. [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration) (GitHub integration), Supabase, 2 October 2026.
2. [Deployment and branching](https://supabase.com/docs/guides/deployment) (Deployment), Supabase, 2 October 2026.
