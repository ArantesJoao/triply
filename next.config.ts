import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The PR-gate build would otherwise write into the same `.next/` the dev
   * server is serving from, which corrupts it and blanks the browser. Setting
   * NEXT_DIST_DIR gives that build its own output directory; unset (the dev
   * server, and any deploy host) it stays `.next`.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
