/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Media is streamed through an authenticated route, so no remote image config needed.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
