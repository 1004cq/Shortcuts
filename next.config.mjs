/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow large media uploads via App Router FormData
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
  // Keep uploads out of the image bundler
  webpack: (config) => {
    config.externals = [...(config.externals || []), { "utf-8-validate": "commonjs utf-8-validate" }];
    return config;
  },
};

export default nextConfig;
