import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/pedagogie/illustration/*": ["content/pedagogie/cartes*.csv", "content/illustrations/*.svg", "public/motifs.svg"],
    // Le booléen est recalculé côté serveur lors de l'ISR, avec les mêmes assets que l'API.
    "/apprendre/*/*": ["content/pedagogie/cartes*.csv", "content/illustrations/*.svg", "public/motifs.svg"],
    "/apprendre/*/*/edition/*": ["content/pedagogie/cartes*.csv", "content/illustrations/*.svg", "public/motifs.svg"],
  },
};

export default nextConfig;
