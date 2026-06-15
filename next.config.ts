import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Prevent iOS PWA from serving stale HTML — let JS bundles
        // keep their content-hash-based long cache
        source: '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|sw.js|icon-192.png|icon-512.png).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
};

export default nextConfig;
