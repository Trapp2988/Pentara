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

function reqUrl(path) {
  return `${getBaseUrl()}${path}`;
}

export async function fetchMeetings(clientId) {
  const cid = (clientId || "").trim();
  if (!cid) throw new Error("clientId is required");

  const res = await fetch(
    reqUrl(`/clients/${encodeURIComponent(cid)}/meetings`),
    { method: "GET" }
  );

  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(
      data?.error || `GET /clients/${cid}/meetings failed (${res.status})`
    );
  }
  return data.meetings || [];
}

export async function generateTasks(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  const res = await fetch(
    reqUrl(
      `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(
        mid
      )}/generate-tasks`
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  const data = await readJson(res);
  if (!res.ok) {
    const msg =
      data?.error ||
      `POST /clients/${cid}/meetings/${mid}/generate-tasks failed (${res.status})`;
    const extra = data?.transcript_status
      ? ` (transcript_status=${data.transcript_status})`
      : "";
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
    reqUrl(
      `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(
        mid
      )}/approve-tasks`
    ),
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

/**
 * Revise the CURRENT tasks/questions using user instructions.
 * Backend: POST /clients/{client_id}/meetings/{meeting_id}/revise-tasks
 * Body: { instructions: "..." }
 */
export async function reviseTasks(clientId, meetingId, instructions) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  const ins = (instructions || "").trim();

  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");
  if (!ins) throw new Error("instructions is required");

  const res = await fetch(
    reqUrl(
      `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(
        mid
      )}/revise-tasks`
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: ins }),
    }
  );

  const data = await readJson(res);
  if (!res.ok) {
    const msg =
      data?.error ||
      `POST /clients/${cid}/meetings/${mid}/revise-tasks failed (${res.status})`;
    const extra = data?.transcript_status
      ? ` (transcript_status=${data.transcript_status})`
      : "";
    throw new Error(msg + extra);
  }

  return data;
}

/**
 * Save manual edits for tasks/questions.
 * Backend: PUT /clients/{client_id}/meetings/{meeting_id}/tasks
 * Body: { tasks: [...], research_questions: [...] }
 */
export async function saveTasks(clientId, meetingId, { tasks, research_questions }) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();

  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");
  if (!Array.isArray(tasks)) throw new Error("tasks must be an array");
  if (!Array.isArray(research_questions)) throw new Error("research_questions must be an array");

  const res = await fetch(
    reqUrl(
      `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/tasks`
    ),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks, research_questions }),
    }
  );

  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(
      data?.error ||
        `PUT /clients/${cid}/meetings/${mid}/tasks failed (${res.status})`
    );
  }

  return data;
}
