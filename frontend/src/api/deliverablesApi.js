const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE_URL");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchDeliverables(clientId, meetingId) {
  return request(
    `/clients/${encodeURIComponent(clientId)}/meetings/${encodeURIComponent(meetingId)}/deliverables`,
    { method: "GET" }
  );
}

export async function generateDeliverables(clientId, meetingId, language) {
  return request(
    `/clients/${encodeURIComponent(clientId)}/meetings/${encodeURIComponent(meetingId)}/generate-deliverables`,
    { method: "POST", body: JSON.stringify({ language }) }
  );
}

export async function reviseDeliverables(clientId, meetingId, instructions) {
  return request(
    `/clients/${encodeURIComponent(clientId)}/meetings/${encodeURIComponent(meetingId)}/revise-deliverables`,
    { method: "POST", body: JSON.stringify({ instructions }) }
  );
}

export async function approveDeliverables(clientId, meetingId) {
  return request(
    `/clients/${encodeURIComponent(clientId)}/meetings/${encodeURIComponent(meetingId)}/approve-deliverables`,
    { method: "POST" }
  );
}
