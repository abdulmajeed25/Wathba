import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@wathba/types', '@wathba/ui-tokens'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default config;
