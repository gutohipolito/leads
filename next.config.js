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
  }
};

module.exports = nextConfig;
