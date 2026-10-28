import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The current frontend routes are statically generated. Export them as files
  // for Cloudflare Workers Static Assets; the API will be a separate Worker.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
