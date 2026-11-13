/**
 * The content security policy trial's report receiver (13 Nov 2026; docs/security/csp-trial.md): POST /csp-report,
 * answered by src/server.ts before the app. Browsers send either the older `application/csp-report` body
 * ({ "csp-report": { … } }) or the Reporting API's `application/reports+json` list. From each report only the
 * directive and the blocked resource's host are kept (a keyword such as `inline`, `eval` or `data` for a resource
 * with no host); never the page or resource URL, a path, a query, a script sample or anything about the player.
 * Rate limited per network (the address is hashed for the counter and never stored).
 */
import type { Db } from "@/lib/data/db.server";

/** Reports one network may send: 120 every 10 minutes. */
export const CSP_REPORT_LIMIT = { bucket: "ip-csp-report", max: 120, windowSeconds: 600 } as const;
/** The most reports read from one request, and the largest body read. */
export const CSP_REPORTS_PER_REQUEST = 10;
export const CSP_REPORT_MAX_BYTES = 16_384;

export interface CspReportRow {
  directive: string;
  blocked_host: string;
}

/** Blocked "URIs" that are keywords, not addresses. */
const KEYWORDS = new Set(["inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink", "self", "data", "blob", "about", "filesystem", "mediastream"]);

/** The directive's name alone (`script-src-elem`, never its values), or null. */
export function directiveOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return /^[a-z][a-z-]{1,39}$/.test(name) ? name : null;
}

/** The blocked resource's host, or its keyword; "other" for anything else. Never a path or query. */
export function blockedHostOf(value: unknown): string {
  if (typeof value !== "string" || !value) return "other";
  const v = value.trim().toLowerCase();
  const bare = v.replace(/:$/, "");
  if (KEYWORDS.has(bare)) return bare;
  try {
    const url = new URL(v);
    if (url.protocol === "data:" || url.protocol === "blob:" || url.protocol === "about:") return url.protocol.slice(0, -1);
    const host = url.hostname;
    return /^[a-z0-9.-]{1,253}$/.test(host) ? host : "other";
  } catch {
    return "other";
  }
}

/** The rows a report body holds (at most CSP_REPORTS_PER_REQUEST), from either format. Pure. */
export function cspReportRows(body: unknown): CspReportRow[] {
  const reports: Record<string, unknown>[] = [];
  if (Array.isArray(body)) {
    for (const item of body.slice(0, CSP_REPORTS_PER_REQUEST)) {
      const r = item as { type?: unknown; body?: unknown } | null;
      if (r && r.type === "csp-violation" && r.body && typeof r.body === "object") reports.push(r.body as Record<string, unknown>);
    }
  } else if (body && typeof body === "object") {
    const r = (body as Record<string, unknown>)["csp-report"];
    if (r && typeof r === "object") reports.push(r as Record<string, unknown>);
  }
  const rows: CspReportRow[] = [];
  for (const r of reports) {
    const directive = directiveOf(r["effectiveDirective"] ?? r["effective-directive"] ?? r["violated-directive"]);
    if (!directive) continue;
    rows.push({ directive, blocked_host: blockedHostOf(r["blockedURL"] ?? r["blocked-uri"]) });
  }
  return rows;
}

/** Answers one POST /csp-report: the rows stored (best effort), always 204 for a report and 405 for anything else. */
export async function handleCspReport(
  request: Request,
  deps: { db: () => Promise<Db>; within: (client: Db, key: string) => Promise<boolean>; addressKey: (address: string) => Promise<string> },
): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  try {
    const text = await request.text();
    if (text.length > CSP_REPORT_MAX_BYTES) return new Response(null, { status: 204 });
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(null, { status: 204 });
    }
    const rows = cspReportRows(body);
    if (rows.length === 0) return new Response(null, { status: 204 });
    const client = await deps.db();
    const address = request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (address && !(await deps.within(client, await deps.addressKey(address)))) return new Response(null, { status: 204 });
    const { insertCspReports } = await import("@/lib/data/csp.server");
    const { error } = await insertCspReports(client, rows);
    if (error) console.warn("[csp-report] not stored:", error.message);
  } catch (err) {
    console.warn("[csp-report] not stored:", err instanceof Error ? err.message : "error");
  }
  return new Response(null, { status: 204 });
}
