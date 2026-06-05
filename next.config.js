/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Forçando a detecção do diretório src se necessário
  experimental: {
    // turbo: {} 
  },
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
      connect-src 'self' https://rwtjkvwccxpsfoxmueuo.supabase.co wss://rwtjkvwccxpsfoxmueuo.supabase.co;
      img-src 'self' data: https://api.dicebear.com https://rwtjkvwccxpsfoxmueuo.supabase.co;
      style-src 'self' 'unsafe-inline';
      frame-src 'self' https://challenges.cloudflare.com;
      media-src 'self' https://assets.mixkit.co;
      font-src 'self' data:;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          }
        ],
      },
    ];
  }
};

module.exports = nextConfig;
