import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erzeugt einen minimalen, eigenständigen Server-Output (.next/standalone)
  // für ein schlankes Docker-Image ohne node_modules-Kopie im Runner-Stage.
  output: "standalone",
};

export default nextConfig;
