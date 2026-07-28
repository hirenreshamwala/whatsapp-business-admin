/** Thin fetch wrapper for client components. Throws on non-2xx with the server message. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      (isJson && body && typeof body === "object" && "error" in body && (body as { error: string }).error) ||
      `Request failed (${res.status})`;
    throw new Error(message as string);
  }
  return body as T;
}
