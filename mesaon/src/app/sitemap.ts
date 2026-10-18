import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/sobre", "/contato", "/termos", "/privacidade", "/cookies", "/cadastro", "/entrar"].map((p) => ({ url: `${base}${p}` }));
}
