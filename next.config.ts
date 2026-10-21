import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "@prisma/adapter-libsql",
    "@libsql/client",
    "playwright",
  ],
  devIndicators: false,
};

export default nextConfig;
