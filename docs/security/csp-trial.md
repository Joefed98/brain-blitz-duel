# Content security policy: the report-only trial (13 Nov 2026)

Every production response carries `Content-Security-Policy-Report-Only` (built in `src/lib/security/csp.ts`) and
`Reporting-Endpoints: csp="https://<host>/csp-report"`. Browsers report what the policy would refuse and refuse
nothing; the app behaves exactly as before. The enforced header is still `frame-ancestors` only
(`src/lib/securityHeaders.ts`).

The policy allows the app's own origin, the Supabase project (https and wss), Google Fonts, Cloudflare Turnstile and,
once `SENTRY_DSN` is set, Sentry's ingest host. The two inline boot scripts in the root's `<head>` are allowed by their
SHA-256 hashes, worked out from the scripts' own text when the server starts, so a change to either script changes its
hash with it. The per-request hydration scripts TanStack Start writes are not allowed yet: the week's reports show
what they need (a nonce or `'unsafe-inline'`) before anything is enforced.

## Where reports go

`POST /csp-report` is answered by `src/server.ts` before the app (`src/lib/security/cspReport.server.ts`). It reads
both report formats (`application/csp-report` and the Reporting API's `application/reports+json`), at most 10 reports
a request, and stores one row per report in `public.csp_reports`: the directive's name and the blocked resource's
host, or a keyword (`inline`, `eval`, `data`, `blob`) when there is no host. Nothing else is kept: no page or resource
URL, path, query, script sample, address or anything about the player. One network may send 120 reports every 10
minutes (counted on the hashed address, which is never stored); past that, reports are dropped quietly.

## Reading a week's reports

In the Supabase dashboard's SQL editor:

```sql
SELECT directive,
       blocked_host,
       count(*)            AS reports,
       min(created_at)     AS first_seen,
       max(created_at)     AS last_seen
  FROM public.csp_reports
 WHERE created_at > now() - interval '7 days'
 GROUP BY directive, blocked_host
 ORDER BY reports DESC;
```

`script-src-elem` / `inline` rows are the hydration scripts (and any other inline script); a host row is something the
app loads that the policy doesn't list yet. A follow-up turns the agreed policy on as `Content-Security-Policy`.
