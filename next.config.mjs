import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude PDF parsing libraries from webpack bundling — let Node.js require
  // them natively at runtime. Without this, webpack mangles pdfjs-dist internals
  // and breaks text extraction in Vercel serverless.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: '',
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
