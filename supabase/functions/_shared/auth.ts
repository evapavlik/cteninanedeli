/**
 * Shared authorization for admin/cron edge functions.
 *
 * All functions are deployed with --no-verify-jwt, so anyone who knows the
 * URL can reach them. Endpoints that write data or trigger expensive work
 * (imports, warm-cache, push notifications) must therefore check credentials
 * themselves. Only annotate-reading is intentionally public.
 *
 * Two accepted credentials:
 *  - `x-admin-secret` header matching the ADMIN_SECRET secret
 *    (used by pg_cron jobs and the /admin/import page)
 *  - `Authorization: Bearer <service role key>`
 *    (used by scripts that already hold the service key)
 *
 * Fails closed: if neither secret is configured, every request is rejected.
 */

/** Constant-time string comparison to avoid leaking the secret via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export interface AuthEnv {
  adminSecret?: string | null;
  serviceRoleKey?: string | null;
}

/** Pure core — testable without Deno. */
export function checkAuth(
  headers: { adminSecret?: string | null; authorization?: string | null },
  env: AuthEnv,
): boolean {
  if (env.adminSecret && headers.adminSecret) {
    if (timingSafeEqual(headers.adminSecret, env.adminSecret)) return true;
  }
  if (env.serviceRoleKey && headers.authorization) {
    const token = headers.authorization.replace(/^Bearer\s+/i, "").trim();
    if (token && timingSafeEqual(token, env.serviceRoleKey)) return true;
  }
  return false;
}

/** Request-level check reading secrets from the Deno environment. */
export function isAuthorized(req: Request): boolean {
  return checkAuth(
    {
      adminSecret: req.headers.get("x-admin-secret"),
      authorization: req.headers.get("authorization"),
    },
    {
      adminSecret: Deno.env.get("ADMIN_SECRET"),
      serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
  );
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
