/**
 * Server-side helper for calling the ASP.NET Core GMS API.
 * The Next.js app is a pure API consumer — all business logic lives in the backend.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:5000";

export type BackendError = {
  status: number;
  errorCode: string;
  title?: string;
  detail?: string;
};

export async function backendFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
    });
  } catch {
    // Network failure / timeout / abort — normalize to a synthetic 503 response
    // carrying our machine-readable errorCode so callers handle one shape.
    return new Response(
      JSON.stringify({ errorCode: "BACKEND_UNREACHABLE", title: "BACKEND_UNREACHABLE", status: 503 }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function readBackendError(response: Response): Promise<BackendError> {
  try {
    const body = (await response.json()) as {
      errorCode?: string;
      title?: string;
      detail?: string;
    };
    return {
      status: response.status,
      errorCode: body.errorCode ?? body.title ?? "GENERIC",
      title: body.title,
      detail: body.detail,
    };
  } catch {
    return { status: response.status, errorCode: "GENERIC" };
  }
}
