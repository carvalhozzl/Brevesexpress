import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/admin", "/m/", "/convite/", "/api/", "/onboarding"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
