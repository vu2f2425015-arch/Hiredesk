# HiredeskHR — Current Deployment and Release Readiness

**Reviewed:** 2026-10-31
**Frontend:** [hiredesk-smoky.vercel.app](https://hiredesk-smoky.vercel.app/)
**Repository branch reviewed:** `master` at `8840a678567f5d1122538ad8097c0c362f225755`

## What was verified in this review

- The public frontend loaded over HTTPS.
- `GET /api/health` through the frontend deployment returned HTTP success and JSON reporting API status `ok`, service `hiredesk-api`, version `0.1.0`, and environment `production`.
- The deployed sign-in page displayed a “Pre-configured Testing Accounts” section and “Show quick fill” control. Those strings and controls are absent from the reviewed `master` source and its local production build. This is evidence that the deployed frontend does not match the reviewed repository state. The quick-fill control was not opened; treat it as a possible credential exposure until the deployed artifact is reconciled.
- The deployed landing page showed horizontal overflow at a 700-pixel browser width. A responsive navigation fix is included in the local changes but is not yet deployed.
- The health response reports API process health only. It does not test PostgreSQL, Supabase Storage, IMAP, SMTP, or worker processing.
- Deployment configuration in this repository builds the frontend for Vercel and defines API and worker services on Render. Confirm the active provider settings and environment variables in both dashboards before a client handoff.
- The repository contains automated tests, but no build, typecheck, test suite, mail delivery, or candidate submission was run as part of this review.

## Current release decision

**Suitable for a client demonstration with synthetic data. Not yet approved for production candidate data.**

The application code contains tenant-aware authorization, private resume storage integration, client-facing application workflows, and an inbound mail worker. A successful API health response does not verify those connected systems or their production configuration.

## Remaining work before a live pilot

1. **Verify the deployed integrations.** Add authenticated operational checks for database and storage connectivity, and a worker heartbeat/queue status. Do not display an integration as “active” or “verified” unless a live check supports that claim.
2. **Verify tenant boundaries on the deployed environment.** Run positive and negative checks using separate agency and client accounts. Confirm private notes and resume files cannot cross those boundaries.
3. **Define and implement candidate retention and erasure.** The prior 180-day policy was a documented requirement, not a verified implementation. Agree on the retention period with the client, then implement deletion across candidate, application, resume storage, and audit records with a recoverable process where required.
4. **Confirm operations.** Verify backups are encrypted and restorable, monitoring and alerting are configured, and recovery ownership and response expectations are agreed. The database backup script now refuses to retain plaintext dumps when encryption is not configured.
5. **Confirm email behavior.** Verify inbound processing and outbound delivery with the client’s authorized mail accounts; the API health endpoint does not validate either.
6. **Complete client-specific privacy and hosting review.** Confirm the hosting region, applicant notice, access policy, retention terms, and incident contact with the client before collecting real applicant data.
7. **Run and record the release checks.** Record build, typecheck, automated test, accessibility, and deployment smoke-check results against the exact commit being released.

## Known limitations

- Authentication token and profile state are cached briefly; disabled accounts or revoked tokens can take up to 10 seconds to stop being accepted.
- PostgreSQL row-level security is not the primary tenant boundary in this architecture; backend services use the privileged database connection and enforce tenant scope in application queries. Keep cross-tenant negative checks in release verification.
- Public health currently reports API process uptime and version only. Database, storage, worker, and mail delivery status are not exposed.
- Reconcile the deployed Vercel build with the reviewed Git commit, remove any test-account UI from production, and verify the served sign-in bundle before sharing the URL with a client.
- A production `trust proxy` hop is configured for the current single-proxy deployment model. Revisit it if the network path changes.
- A local environment file and password-named file were present in the workspace during review, but are ignored and not tracked. Exclude local secrets from handoff archives and rotate any credential that was shared outside its intended environment.

## Client handoff guidance

Share the demo URL and explain that this is a demonstration deployment. Use synthetic candidate information until the pilot requirements above are complete. Do not describe the current health badge as proof of database, mail, or tenant-isolation verification.
