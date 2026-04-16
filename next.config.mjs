/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "100.68.175.37",
    ...(process.env.ALLOWED_DEV_ORIGINS
      ? process.env.ALLOWED_DEV_ORIGINS.split(",")
      : []),
  ],
  async rewrites() {
    return [
      {
        source: "/about",
        destination: "/about/about_judy.html",
      },
    ];
  },
};

export default nextConfig;
