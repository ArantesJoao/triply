import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * The dev server and a local `next build` must never share a `distDir`.
 *
 * They collide badly on Windows. `next build` begins by emptying `distDir`
 * (everything but `cache/`), and `.next/trace` is held open by the running dev
 * server, so the unlink fails with EPERM and leaves the file delete-pending —
 * present in the directory but impossible to open or remove. Next's
 * `recursiveDelete` retries that error forever (its backoff counter is
 * post-incremented, so the `t < 3` bound never trips), so the build hangs
 * before it compiles anything, prints nothing, and never exits. It also
 * corrupts the `.next/` the dev server is serving from, blanking the browser.
 *
 * So the dev server keeps `.next`, and every other local phase — `next build`,
 * `next start` — gets `.next-build` to itself. On Vercel there is no dev server
 * to collide with and the platform expects `.next`, so VERCEL opts back in.
 * NEXT_DIST_DIR overrides both, for running a second build side by side.
 */
/**
 * OAuth discovery documents have to sit at `/.well-known/…` on the origin
 * itself — that is the whole point of a well-known URI, and RFC 8414 checks
 * that the issuer matches where the document was found.
 *
 * They are served from route handlers under `/api/well-known/` and rewritten
 * into place here, rather than from an `app/.well-known/` directory: a
 * leading-dot segment is not a routing convention Next promises to keep, and a
 * rewrite is plainly a rewrite.
 *
 * Each document answers on two paths. RFC 9728 tells a client holding the
 * resource URL `https://host/api/mcp` to look under
 * `/.well-known/oauth-protected-resource/api/mcp`, while an older client asks
 * for the bare path; there is one protected resource here, so both are true.
 */
const wellKnown = [
  "oauth-protected-resource",
  "oauth-authorization-server",
].flatMap((document) => [
  { source: `/.well-known/${document}`, destination: `/api/well-known/${document}` },
  {
    source: `/.well-known/${document}/:path*`,
    destination: `/api/well-known/${document}`,
  },
]);

const nextConfig = (phase: string): NextConfig => ({
  distDir:
    process.env.NEXT_DIST_DIR ||
    (phase === PHASE_DEVELOPMENT_SERVER || process.env.VERCEL
      ? ".next"
      : ".next-build"),
  rewrites: async () => wellKnown,
});

export default nextConfig;
