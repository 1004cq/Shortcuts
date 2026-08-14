/** @type {import('next').NextConfig} */
const nextConfig = {
  // Smaller deploy artifact for low-RAM VPS (no remote `next build`)
  output: "standalone",
  experimental: {
    // Allow large media uploads via App Router FormData
    serverActions: {
      bodySizeLimit: "2gb",
    },
    // Keep Alipay SDK external so Node loads it after File polyfill
    serverComponentsExternalPackages: ["alipay-sdk", "sharp"],
    instrumentationHook: true,
  },
  // Keep uploads out of the image bundler
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), { "utf-8-validate": "commonjs utf-8-validate" }];
    if (isServer) {
      config.externals.push("alipay-sdk");
      config.externals.push("sharp");
    }
    return config;
  },
};

export default nextConfig;
