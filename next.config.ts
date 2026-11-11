import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF rendering uses native canvas bindings; keep them out of the server bundle.
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "@napi-rs/canvas"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
