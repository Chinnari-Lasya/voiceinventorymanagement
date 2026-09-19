import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native module: must not be bundled (ARCHITECTURE §12).
  serverExternalPackages: ["better-sqlite3"],
  // Friendly aliases for the auth pages (real routes are /signin and /signup).
  async redirects() {
    return [
      { source: "/sign-in", destination: "/signin", permanent: false },
      { source: "/sign-up", destination: "/signup", permanent: false },
    ];
  },
};

export default nextConfig;
