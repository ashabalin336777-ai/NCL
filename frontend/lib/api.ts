import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/cookies";
import type { ApiErrorBody, TokenResponse, User } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function formatDetail(detail: ApiErrorBody["detail"]): string {
  if (!detail) {
    return "Request failed";
  }
  if (typeof detail === "string") {
    return detail;
  }
  return detail.map((item) => item.msg ?? "Validation error").join("; ");
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, formatDetail(body.detail));
  } catch {
    return new ApiError(response.status, response.statusText || "Request failed");
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearAuthTokens();
    return null;
  }
  const data = (await response.json()) as TokenResponse;
  setAuthTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function ensureFreshToken(): Promise<string | null> {
  const current = getAccessToken();
  if (current) {
    return current;
  }
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const withAuth = options.auth !== false;
  if (withAuth) {
    const token = await ensureFreshToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && withAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const nextToken = await refreshPromise;
    if (nextToken) {
      headers.set("Authorization", `Bearer ${nextToken}`);
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function loginRequest(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false },
  );
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return;
  }
  try {
    await apiFetch(
      "/auth/logout",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      { auth: false },
    );
  } catch {
    // ignore logout network errors
  }
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}
