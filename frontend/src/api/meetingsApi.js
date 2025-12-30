const BASE_URL = import.meta.env.VITE_CLIENTS_API_BASE_URL;

function getBaseUrl() {
  if (!BASE_URL) {
    throw new Error(
      "Missing VITE_CLIENTS_API_BASE_URL (set in Amplify env vars / local .env)."
    );
  }
  return BASE_URL.replace(/\/+$/, "");
}

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  return data || {};
}

export async function fetchMeetings(clientId) {
  const cid = (clientId || "").trim();
  if (!cid) throw new Error("clientId is required");

  const res = await fetch(`${getBaseUrl()}/clients/${encodeURIComponent(cid)}/meetings`, {
    method: "GET",
  });

  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `GET /clients/${cid}/meetings failed (${res.status})`);
  }
  return data.meetings || [];
}

export async function generateTasks(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  const res = await fetch(
    `${getBaseUrl()}/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(
      mid
    )}/generate-tasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  const data = await readJson(res);
  if (!res.ok) {
    // Preserve transcript-not-ready details if provided
    const msg =
      data?.error ||
      `POST /clients/${cid}/meetings/${mid}/generate-tasks failed (${res.status})`;
    const extra =
      data?.transcript_status ? ` (transcript_status=${data.transcript_status})` : "";
    throw new Error(msg + extra);
  }

  return data;
}

export async function approveTasks(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  const res = await fetch(
    `${getBaseUrl()}/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(
      mid
    )}/approve-tasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `POST /approve-tasks failed (${res.status})`);
  }
  return data;
}
