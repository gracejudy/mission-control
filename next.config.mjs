import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack auto-detected /Users/judy/package-lock.json as the workspace root
  // (there's also one at judy-brain/), so its dev watcher covered the whole home
  // directory — any write anywhere under it (crawler-pipeline, brain daemon, etc.)
  // triggered a full page reload here. Pin it to this project only.
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    "100.68.175.37",
    "bot-macmini.tail7c5820.ts.net",
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
