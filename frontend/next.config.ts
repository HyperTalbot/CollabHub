import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // В монорепозитории два lockfile (корень + frontend) —
  // явно указываем корень трейсинга, чтобы Next не угадывал
  outputFileTracingRoot: path.join(__dirname, "../"),
};

export default nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     domains: ['localhost', 'api.dicebear.com', 'images.unsplash.com'],
//   },
//   webpack: (config) => {
//     config.resolve.fallback = { fs: false, net: false, tls: false };
//     return config;
//   },
// }

// module.exports = nextConfig