export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`/backend${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "The backend is unavailable. Start the Laravel API server or verify the BACKEND_URL setting.",
    );
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> = {};
  const isJsonResponse = contentType.includes("application/json");

  if (text) {
    if (isJsonResponse) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error("The backend returned invalid JSON.");
      }
    } else if (response.ok) {
      throw new Error("The backend returned an unexpected response format.");
    }
  }

  if (!response.ok) {
    const validationErrors = payload.errors as Record<string, string[]> | undefined;
    const validationMessage = validationErrors
      ? Object.values(validationErrors).flat()[0]
      : undefined;
    const plainTextMessage =
      !isJsonResponse && text && !text.trim().startsWith("<") ? text.trim() : undefined;
    const proxyFailureMessage =
      !isJsonResponse && [500, 502, 503, 504].includes(response.status)
        ? "The backend is unavailable. Start the Laravel API server or verify the BACKEND_URL setting."
        : undefined;

    throw new Error(
      validationMessage ??
        (payload.message as string | undefined) ??
        proxyFailureMessage ??
        plainTextMessage ??
        "The request could not be completed.",
    );
  }

  return payload as T;
}
