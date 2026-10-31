import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import packageJson from "./package.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_COMMIT_SHA:
      process.env.CF_PAGES_COMMIT_SHA
      ?? process.env.GITHUB_SHA
      ?? process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA
      ?? "local-build",
  },
};

export default nextConfig;
