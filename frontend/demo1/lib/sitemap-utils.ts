import type { MetadataRoute } from "next";

export const BASE_URL = "https://menes-skr.com";

interface SitemapEntry {
  url: string;
  lastModified?: Date | string;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export function toSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      let xml = `  <url>\n    <loc>${escapeXml(e.url)}</loc>`;
      if (e.lastModified) {
        const d = e.lastModified instanceof Date ? e.lastModified.toISOString() : e.lastModified;
        xml += `\n    <lastmod>${d}</lastmod>`;
      }
      if (e.changeFrequency) xml += `\n    <changefreq>${e.changeFrequency}</changefreq>`;
      if (e.priority !== undefined) xml += `\n    <priority>${e.priority}</priority>`;
      xml += `\n  </url>`;
      return xml;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function toSitemapIndexXml(sitemaps: { loc: string; lastmod?: string }[]): string {
  const entries = sitemaps
    .map((s) => {
      let xml = `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>`;
      if (s.lastmod) xml += `\n    <lastmod>${s.lastmod}</lastmod>`;
      xml += `\n  </sitemap>`;
      return xml;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
