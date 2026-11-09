# 9 November QA fixes

- KE-02/03: require both valid custom dates before loading visits; label the selected period. Today showing zero is valid when there are no visits today; incomplete custom filters no longer expose all historical visits.
- KE-04: POS empty states distinguish an empty category from a search with no matches.
- KE-05: completed and in-consultation queues have matching descriptions.
- KE-06: opening tutorial no longer calls Help Center the admin dashboard.
- KE-07: POS category labels use consistent capitalization. Deployment corrects the exact `SCOUT KIDS FARME` catalogue record to `SCOUT KIDS FRAME`, with a database backup.
- KE-08: invalid discounts disable checkout and completion; API schemas reject negative, non-finite and over-100-percent discounts.
- KE-09: analytics uses calendar week, month and year boundaries, matching revenue and accounting. Product sale revenue is included in the sales breakdown.
- KE-10: navbar and Global Search retain terms only in memory; search sends a POST body. Old persisted recent searches are cleared, and session cleanup clears memory. Legacy URL queries are removed with history replacement.
- KE-11: product search matches SKU as well as name.
- KE-12: lab actions return SMS queue status and errors; UI distinguishes queued, failed and skipped messages. Live carrier delivery remains unverified.
- KE-13: isolated regression test verifies a received 200-cedi lens, 40-cedi VAT at 20%, a 240-cedi sale and separate PDF sale receipt. Existing frame VAT tests also pass.
- KE-14: catalogue and branch stock refresh on entering POS and every 15 seconds. Received lens flow passes regression tests. Current staging test lens has a pending delivery and zero branch stock; no delivery was confirmed by this release.
- KE-15: Front Desk polls visit status every five seconds; doctor queue changes invalidate the shared visit query.

Validation: 25 QA/lab/VAT/payment/review tests and 44 existing security/pentest/superadmin tests passed. `npm run build` passed. Mocked browser interactions and rendered POS were checked at 1440px and 390px in light and dark modes.

No database schema migration. No legacy frontend edits. Production code is deployed as a patch from the existing committed baseline; main is unchanged.

SMS production follow-up: the API timed out over HTTP/1.1 while HTTP/2 returned promptly. Enable HTTP/2 for Arkesel send and balance requests and include HTTPX's optional HTTP/2 dependency. The replacement credential is stored only in production settings.
