import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-constants";

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  const part = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  if (!part) {
    return null;
  }
  return decodeURIComponent(part.slice(prefix.length));
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAccessToken(): string | null {
  return getCookie(ACCESS_COOKIE);
}

export function getRefreshToken(): string | null {
  return getCookie(REFRESH_COOKIE);
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  setCookie(ACCESS_COOKIE, accessToken, 60 * 30);
  setCookie(REFRESH_COOKIE, refreshToken, 60 * 60 * 24 * 7);
}

export function clearAuthTokens(): void {
  clearCookie(ACCESS_COOKIE);
  clearCookie(REFRESH_COOKIE);
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
