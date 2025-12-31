import { useEffect, useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function apiFetch(path, options = {}) {
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

export default function SpecSheetsTab({ selectedClientId }) {
  const [meetings, setMeetings] = useState([]);
  const [meetingId, setMeetingId] = useState("");

  const [language, setLanguage] = useState("R"); // R | SAS | BOTH
  const [revisePrompt, setRevisePrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.meeting_id === meetingId) || null,
    [meetings, meetingId]
  );

  const canUse = !!selectedClientId;
  const tasksApproved =
    (selectedMeeting?.tasks_status || "").toLowerCase() === "approved";

  async function loadMeetings(autoselect = true) {
    if (!selectedClientId) {
      setMeetings([]);
      setMeetingId("");
      return;
    }
    setErr("");
    const data = await apiFetch(`/clients/${encodeURIComponent(selectedClientId)}/meetings`);
    const list = data?.meetings || [];
    setMeetings(list);

    if (autoselect) {
      // Prefer most recently updated meeting if none chosen
      if (!meetingId && list.length) setMeetingId(list[0].meeting_id);
    }
  }

  async function loadDeliverables() {
    if (!selectedClientId || !meetingId) return;
    setErr("");
    const d = await apiFetch(
      `/clients/${encodeURIComponent(selectedClientId)}/meetings/${encodeURIComponent(meetingId)}/deliverables`
    );

    // Merge deliverables snapshot into meetings array (so UI reflects statuses/keys)
    setMeetings((prev) =>
      prev.map((m) =>
        m.meeting_id === meetingId
          ? {
              ...m,
              deliverables_status: d.deliverables_status,
              deliverables_revision: d.deliverables_revision,
              deliverables_language: d.deliverables_language,
              spec_sheets: d.spec_sheets || [],
              code_templates: d.code_templates || [],
              last_deliverables_instructions: d.last_deliverables_instructions || "",
            }
          : m
      )
    );
  }

  async function generateDeliverables() {
    if (!selectedClientId || !meetingId) return;
    setBusy(true);
    setErr("");
    try {
      const d = await apiFetch(
        `/clients/${encodeURIComponent(selectedClientId)}/meetings/${encodeURIComponent(meetingId)}/generate-deliverables`,
        { method: "POST", body: JSON.stringify({ language }) }
      );

      setMeetings((prev) =>
        prev.map((m) =>
          m.meeting_id === meetingId
            ? {
                ...m,
                deliverables_status: d.deliverables_status,
                deliverables_revision: d.deliverables_revision,
                deliverables_language: d.deliverables_language,
                spec_sheets: d.spec_sheets || [],
                code_templates: d.code_templates || [],
              }
            : m
        )
      );
    } catch (e) {
      setErr(e.message || "Failed to generate deliverables");
    } finally {
      setBusy(false);
    }
  }

  async function reviseDeliverables() {
    if (!selectedClientId || !meetingId) return;
    if (!revisePrompt.trim()) {
      setErr("Enter revision instructions first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const d = await apiFetch(
        `/clients/${encodeURIComponent(selectedClientId)}/meetings/${encodeURIComponent(meetingId)}/revise-deliverables`,
        { method: "POST", body: JSON.stringify({ instructions: revisePrompt }) }
      );

      setMeetings((prev) =>
        prev.map((m) =>
          m.meeting_id === meetingId
            ? {
                ...m,
                deliverables_status: d.deliverables_status,
                deliverables_revision: d.deliverables_revision,
                deliverables_language: d.deliverables_language,
                spec_sheets: d.spec_sheets || [],
                code_templates: d.code_templates || [],
                last_deliverables_instructions: revisePrompt,
              }
            : m
        )
      );
    } catch (e) {
      setErr(e.message || "Failed to revise deliverables");
    } finally {
      setBusy(false);
    }
  }

  async function approveDeliverables() {
    if (!selectedClientId || !meetingId) return;
    setBusy(true);
    setErr("");
    try {
      const d = await apiFetch(
        `/clients/${encodeURIComponent(selectedClientId)}/meetings/${encodeURIComponent(meetingId)}/approve-deliverables`,
        { method: "POST" }
      );

      setMeetings((prev) =>
        prev.map((m) =>
          m.meeting_id === meetingId
            ? { ...m, deliverables_status: d.deliverables_status }
            : m
        )
      );
    } catch (e) {
      setErr(e.message || "Failed to approve deliverables");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // load meetings when client changes
    loadMeetings(true).catch((e) => setErr(e.message || "Failed to load meetings"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    // load deliverables whenever meeting changes (lightweight)
    if (!selectedClientId || !meetingId) return;
    loadDeliverables().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!canUse) {
    return <div className="smallMuted">Select a client to use Spec Sheets.</div>;
  }

  const deliverablesStatus = (selectedMeeting?.deliverables_status || "none").toLowerCase();
  const deliverablesApproved = deliverablesStatus === "approved";
  const specSheets = selectedMeeting?.spec_sheets || [];

  return (
    <div>
      <div className="sectionTitle">Spec Sheets</div>

      {/* Meeting picker */}
      <div className="controlsRow mt16">
        <div className="smallMuted" style={{ fontWeight: 700 }}>
          Meeting
        </div>

        <select
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          disabled={busy}
        >
          <option value="">(select)</option>
          {meetings.map((m) => (
            <option key={m.meeting_id} value={m.meeting_id}>
              {m.meeting_id} — {m.transcript_status || "?"}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => loadMeetings(false)} disabled={busy}>
          Refresh
        </button>

        <button type="button" className="btnSecondary" onClick={loadDeliverables} disabled={busy || !meetingId}>
          Load deliverables
        </button>
      </div>

      {meetingId && (
        <div className="mt16 smallMuted">
          <div>
            <strong>Tasks:</strong>{" "}
            {selectedMeeting?.tasks_status || "none"}{" "}
            {tasksApproved ? "(approved)" : "(must approve tasks first)"}
          </div>
          <div>
            <strong>Deliverables:</strong>{" "}
            {selectedMeeting?.deliverables_status || "none"}{" "}
            {selectedMeeting?.deliverables_revision ? `(rev ${selectedMeeting.deliverables_revision})` : ""}
          </div>
        </div>
      )}

      {err && (
        <div className="mt16" style={{ color: "#b91c1c", fontWeight: 700 }}>
          {err}
        </div>
      )}

      {/* Controls */}
      <div className="mt20" />

      <div className="controlsRow">
        <label className="smallMuted" style={{ fontWeight: 700 }}>
          Output language
        </label>

        <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy || !meetingId}>
          <option value="R">R</option>
          <option value="SAS">SAS</option>
          <option value="BOTH">BOTH (separate files)</option>
        </select>

        <button
          type="button"
          onClick={generateDeliverables}
          disabled={busy || !meetingId || !tasksApproved}
        >
          Generate spec sheets & templates
        </button>

        <button
          type="button"
          onClick={approveDeliverables}
          disabled={busy || !meetingId || deliverablesApproved || !specSheets.length}
        >
          Approve
        </button>
      </div>

      {/* AI revise prompt */}
      <div className="mt20 smallMuted" style={{ fontWeight: 700 }}>
        AI revision prompt
      </div>
      <textarea
        value={revisePrompt}
        onChange={(e) => setRevisePrompt(e.target.value)}
        placeholder="Example: Add a spec sheet section on validation checks and common pitfalls. Keep templates as TODOs only."
        disabled={busy || !meetingId || !tasksApproved}
        rows={4}
      />

      <div className="controlsRow mt16">
        <button
          type="button"
          onClick={reviseDeliverables}
          disabled={busy || !meetingId || !tasksApproved}
        >
          Revise with AI
        </button>
      </div>

      {/* Outputs list */}
      <div className="mt20 sectionTitle">Generated spec sheets (S3 keys)</div>
      {!meetingId ? (
        <div className="smallMuted">Select a meeting.</div>
      ) : !specSheets.length ? (
        <div className="smallMuted">No spec sheets yet. Generate deliverables first.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {specSheets.map((s) => (
            <div
              key={s.s3_key}
              style={{
                border: "1px solid rgba(15, 23, 42, 0.12)",
                borderRadius: 12,
                padding: 12,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a" }}>
                Task {String(s.task_index).padStart(2, "0")}: {s.task_title || ""}
              </div>
              <div className="smallMuted" style={{ marginTop: 6 }}>
                <strong>S3:</strong> {s.s3_key}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt20 smallMuted">
        Note: this UI lists S3 keys. If you want “Open / Preview” in the browser, add a backend endpoint that returns a
        presigned GET URL or returns the file contents.
      </div>
    </div>
  );
}
