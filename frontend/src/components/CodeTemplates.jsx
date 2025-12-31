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

export default function CodeTemplatesTab({ selectedClientId }) {
  const [meetings, setMeetings] = useState([]);
  const [meetingId, setMeetingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.meeting_id === meetingId) || null,
    [meetings, meetingId]
  );

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
    if (autoselect && !meetingId && list.length) setMeetingId(list[0].meeting_id);
  }

  async function loadDeliverables() {
    if (!selectedClientId || !meetingId) return;
    setBusy(true);
    setErr("");
    try {
      const d = await apiFetch(
        `/clients/${encodeURIComponent(selectedClientId)}/meetings/${encodeURIComponent(meetingId)}/deliverables`
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
      setErr(e.message || "Failed to load deliverables");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadMeetings(true).catch((e) => setErr(e.message || "Failed to load meetings"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    if (!meetingId) return;
    loadDeliverables().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!selectedClientId) {
    return <div className="smallMuted">Select a client to use Code Templates.</div>;
  }

  const templates = selectedMeeting?.code_templates || [];
  const deliverablesStatus = selectedMeeting?.deliverables_status || "none";
  const lang = selectedMeeting?.deliverables_language || "";

  return (
    <div>
      <div className="sectionTitle">Code Templates</div>

      <div className="controlsRow mt16">
        <div className="smallMuted" style={{ fontWeight: 700 }}>
          Meeting
        </div>

        <select value={meetingId} onChange={(e) => setMeetingId(e.target.value)} disabled={busy}>
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
          Load templates
        </button>
      </div>

      {meetingId && (
        <div className="mt16 smallMuted">
          <div>
            <strong>Deliverables:</strong> {deliverablesStatus}{" "}
            {selectedMeeting?.deliverables_revision ? `(rev ${selectedMeeting.deliverables_revision})` : ""}
          </div>
          <div>
            <strong>Language:</strong> {lang || "(not set)"}
          </div>
        </div>
      )}

      {err && (
        <div className="mt16" style={{ color: "#b91c1c", fontWeight: 700 }}>
          {err}
        </div>
      )}

      <div className="mt20 sectionTitle">Generated templates (S3 keys)</div>

      {!meetingId ? (
        <div className="smallMuted">Select a meeting.</div>
      ) : !templates.length ? (
        <div className="smallMuted">
          No templates yet. Generate deliverables in the Spec Sheets tab first.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {templates.map((t) => (
            <div
              key={`${t.task_index}-${t.language}-${t.s3_key}`}
              style={{
                border: "1px solid rgba(15, 23, 42, 0.12)",
                borderRadius: 12,
                padding: 12,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a" }}>
                Task {String(t.task_index).padStart(2, "0")} — {t.language}
              </div>
              <div className="smallMuted" style={{ marginTop: 6 }}>
                <strong>S3:</strong> {t.s3_key}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt20 smallMuted">
        Same note: to preview/download in the browser, add a backend presigned GET endpoint.
      </div>
    </div>
  );
}
