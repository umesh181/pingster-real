/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  webpack: (config) => {
    // This is needed to prevent the edge function from exceeding the size limit
    config.optimization.usedExports = true;
    return config;
  }
}

export default nextConfig
