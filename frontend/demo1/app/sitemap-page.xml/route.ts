import { toSitemapXml, xmlResponse, BASE_URL } from "@/lib/sitemap-utils";

export const revalidate = 86400;

const THERAPIST_TYPES = ["1", "2", "3", "4", "5", "6", "7", "8"];

export async function GET() {
  const now = new Date();

  const entries = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily" as const, priority: 1.0 },
    { url: `${BASE_URL}/area`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE_URL}/search`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${BASE_URL}/ranking`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 },
    ...THERAPIST_TYPES.map((t) => ({
      url: `${BASE_URL}/type/${t}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return xmlResponse(toSitemapXml(entries));
}
