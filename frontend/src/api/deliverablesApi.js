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

/**
 * NEW: Load the actual S3 file contents for a task (spec + template).
 * GET /deliverables-content?task_index=1&language=R
 */
export async function fetchDeliverableContent(clientId, meetingId, taskIndex, language) {
  const ti = Number(taskIndex);
  if (!ti || ti < 1) throw new Error("taskIndex must be >= 1");
  const lang = (language || "R").toUpperCase();

  const q = new URLSearchParams({
    task_index: String(ti),
    language: lang,
  });

  return request(
    `/clients/${encodeURIComponent(clientId)}/meetings/${encodeURIComponent(meetingId)}/deliverables-content?${q.toString()}`,
    { method: "GET" }
  );
}

/**
 * NEW: Save user edits back to S3 (spec + template).
 * PUT /deliverables-content
 */
export async function saveDeliverableContent(clientId, meetingId, payload) {
  return request(
    `/clients/${encodeURIComponent(clientId)}/meetings/${encodeURIComponent(meetingId)}/deliverables-content`,
    { method: "PUT", body: JSON.stringify(payload || {}) }
  );
}
