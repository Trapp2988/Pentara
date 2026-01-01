import React, { useEffect, useMemo, useState } from "react";
import { fetchMeetings } from "../api/meetingsApi";
import { fetchDeliverables } from "../api/deliverablesApi";

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CodeTemplatesTab({ selectedClientId }) {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selectedMeeting = useMemo(() => {
    return meetings.find((m) => m.meeting_id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  const templates = selectedMeeting?.code_templates || [];

  async function refreshMeetings({ preserveSelection = true } = {}) {
    const cid = (selectedClientId || "").trim();
    if (!cid) {
      setMeetings([]);
      setSelectedMeetingId("");
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const list = await fetchMeetings(cid);
      setMeetings(list);

      if (!preserveSelection) {
        setSelectedMeetingId(list?.[0]?.meeting_id || "");
        return;
      }

      let nextId = selectedMeetingId;
      if (!nextId || !list.some((m) => m.meeting_id === nextId)) {
        nextId = list.length > 0 ? list[0].meeting_id : "";
        setSelectedMeetingId(nextId);
      }
    } catch (e) {
      setErr(e.message || "Failed to load meetings");
      setMeetings([]);
      setSelectedMeetingId("");
    } finally {
      setLoading(false);
    }
  }

  async function hydrateDeliverables(meetingId) {
    if (!selectedClientId || !meetingId) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetchDeliverables(selectedClientId, meetingId);
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
    refreshMeetings({ preserveSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedMeetingId) hydrateDeliverables(selectedMeetingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeetingId]);

  async function onChangeMeeting(nextId) {
    setSelectedMeetingId(nextId);
    await hydrateDeliverables(nextId);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ margin: "10px 0" }}>Code Templates</h2>

      {!selectedClientId ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Select a client to view meetings.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <label style={{ fontWeight: 700 }}>Meeting</label>

            <select
              value={selectedMeetingId || ""}
              onChange={(e) => onChangeMeeting(e.target.value)}
              disabled={loading || meetings.length === 0 || busy}
              style={{ padding: 10, minWidth: 360, maxWidth: "100%" }}
            >
              {meetings.length === 0 ? (
                <option value="" disabled>
                  {loading ? "Loading meetings..." : "No meetings found"}
                </option>
              ) : null}

              {meetings.map((m) => (
                <option key={m.meeting_id} value={m.meeting_id}>
                  {m.meeting_id} — deliverables {String(m.deliverables_status || "NONE")}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => refreshMeetings()} disabled={loading || busy}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button type="button" className="btnSecondary" onClick={() => hydrateDeliverables(selectedMeetingId)} disabled={!selectedMeetingId || busy}>
              {busy ? "Loading..." : "Load templates"}
            </button>
          </div>

          {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

          {selectedMeeting ? (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <strong>Meeting ID:</strong> {selectedMeeting.meeting_id}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ opacity: 0.85 }}>
                    <strong>Language:</strong> {selectedMeeting.deliverables_language || "(not set)"}
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    <strong>Updated:</strong> {fmtDate(selectedMeeting.updated_at)}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <h3 style={{ margin: 0 }}>Generated Templates (S3 keys)</h3>

                  {templates.length === 0 ? (
                    <div style={{ marginTop: 8, opacity: 0.85 }}>
                      No templates yet. Generate deliverables in the Spec Sheets tab first.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                      {templates.map((t) => (
                        <div
                          key={`${t.task_index}-${t.language}-${t.s3_key}`}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: 10,
                            padding: 12,
                            background: "#fafafa",
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>
                            Task {String(t.task_index).padStart(2, "0")} — {t.language}
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                            <strong>S3 key:</strong> {t.s3_key}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              {loading ? "Loading..." : "No meeting selected."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
