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

async function request(path, { method = "GET", body } = {}) {
  const opts = { method, headers: {} };

  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${getBaseUrl()}${path}`, opts);
  const data = await readJson(res);

  if (!res.ok) {
    const msg = data?.error || `${method} ${path} failed (${res.status})`;
    const extra = data?.transcript_status
      ? ` (transcript_status=${data.transcript_status})`
      : "";
    throw new Error(msg + extra);
  }

  return data;
}

// =======================
// Meetings
// =======================

export async function fetchMeetings(clientId) {
  const cid = (clientId || "").trim();
  if (!cid) throw new Error("clientId is required");

  const data = await request(`/clients/${encodeURIComponent(cid)}/meetings`, {
    method: "GET",
  });
  return data.meetings || [];
}

// =======================
// Tasks
// =======================

export async function generateTasks(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/generate-tasks`,
    { method: "POST", body: {} }
  );
}

export async function reviseTasks(clientId, meetingId, instructions) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  const ins = (instructions || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");
  if (!ins) throw new Error("instructions is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/revise-tasks`,
    { method: "POST", body: { instructions: ins } }
  );
}

export async function saveTasks(clientId, meetingId, tasks) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");
  if (!Array.isArray(tasks)) throw new Error("tasks must be an array");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/tasks`,
    { method: "PUT", body: { tasks } }
  );
}

export async function approveTasks(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/approve-tasks`,
    { method: "POST", body: {} }
  );
}

// NEW: Clear tasks
export async function clearTasks(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/clear-tasks`,
    { method: "POST", body: {} }
  );
}

// =======================
// Deliverables (async)
// =======================

export async function fetchDeliverables(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/deliverables`,
    { method: "GET" }
  );
}

export async function generateDeliverables(clientId, meetingId, language) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  const lang = (language || "R").trim().toUpperCase();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  // backend expects: R | SAS | BOTH
  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/generate-deliverables`,
    { method: "POST", body: { language: lang } }
  );
}

export async function fetchDeliverablesContent(clientId, meetingId, taskIndex, language) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  const ti = Number(taskIndex);
  const lang = (language || "R").trim().toUpperCase();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");
  if (!Number.isFinite(ti) || ti <= 0) throw new Error("taskIndex must be >= 1");

  const qs = `task_index=${encodeURIComponent(String(ti))}&language=${encodeURIComponent(lang)}`;
  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/deliverables-content?${qs}`,
    { method: "GET" }
  );
}

export async function saveDeliverablesContent(
  clientId,
  meetingId,
  taskIndex,
  language,
  specContent,
  templateContent
) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  const ti = Number(taskIndex);
  const lang = (language || "R").trim().toUpperCase();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");
  if (!Number.isFinite(ti) || ti <= 0) throw new Error("taskIndex must be >= 1");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/deliverables-content`,
    {
      method: "PUT",
      body: {
        task_index: ti,
        language: lang,
        spec_content: specContent ?? "",
        template_content: templateContent ?? "",
      },
    }
  );
}

export async function approveDeliverables(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/approve-deliverables`,
    { method: "POST", body: {} }
  );
}

export async function clearDeliverables(clientId, meetingId) {
  const cid = (clientId || "").trim();
  const mid = (meetingId || "").trim();
  if (!cid) throw new Error("clientId is required");
  if (!mid) throw new Error("meetingId is required");

  return request(
    `/clients/${encodeURIComponent(cid)}/meetings/${encodeURIComponent(mid)}/clear-deliverables`,
    { method: "POST", body: {} }
  );
}

