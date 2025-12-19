const BASE_URL = import.meta.env.VITE_CLIENTS_API_BASE_URL;

function getBaseUrl() {
  if (!BASE_URL) {
    throw new Error("Missing VITE_CLIENTS_API_BASE_URL (set in Amplify env vars / local .env).");
  }
  return BASE_URL.replace(/\/+$/, "");
}

export async function fetchClients() {
  const res = await fetch(`${getBaseUrl()}/clients`, { method: "GET" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `GET /clients failed (${res.status})`);
  }
  return data.clients || [];
}

export async function createClient({ display_name } = {}) {
  const name = (display_name || "").trim();
  if (!name) throw new Error("display_name is required");

  const res = await fetch(`${getBaseUrl()}/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: name }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `POST /clients failed (${res.status})`);
  }
  return data.client;
}
