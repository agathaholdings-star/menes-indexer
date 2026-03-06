export function sanitizeRedirect(url: string | null): string {
  if (!url) return "/mypage";
  if (url.startsWith("/") && !url.startsWith("//") && !url.toLowerCase().startsWith("/\\") && !/^\/[^a-z0-9_/]/i.test(url)) return url;
  return "/mypage";
}
