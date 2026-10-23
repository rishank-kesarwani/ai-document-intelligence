/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Restrict deviceSizes to 3 tiers to avoid generating 8+ variants per image
    deviceSizes: [640, 1080, 1920],
    // Restrict imageSizes to essential thumbnail/icon tiers
    imageSizes: [32, 64, 128, 256],
    // Single modern format to prevent multiplying transformation counts
    formats: ['image/webp'],
    // Increase edge cache lifetime to 30 days (default is 60 seconds)
    minimumCacheTTL: 2592000,
    // Enable safe SVG handling with strict Content Security Policy
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|ico|png|jpg|webp)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
