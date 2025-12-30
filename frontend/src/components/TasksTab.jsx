import React, { useEffect, useMemo, useState } from "react";
import { approveTasks, fetchMeetings, generateTasks } from "../api/meetingsApi";

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusPill(text) {
  const s = (text || "").toUpperCase();
  let bg = "#eee";
  if (s === "READY") bg = "#e6f4ea";
  if (s === "PROCESSING") bg = "#fff4e5";
  if (s === "FAILED") bg = "#fde7e9";
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid #ddd",
        background: bg,
      }}
    >
      {s || "UNKNOWN"}
    </span>
  );
}

export default function TasksTab({ selectedClientId }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  const selectedMeeting = useMemo(() => {
    return meetings.find((m) => m.meeting_id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  const canGenerate = useMemo(() => {
    const t = (selectedMeeting?.transcript_status || "").toUpperCase();
    return !!selectedClientId && !!selectedMeetingId && t === "READY";
  }, [selectedClientId, selectedMeetingId, selectedMeeting]);

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
        setSelectedMeetingId("");
        return;
      }

      // Keep selection if it still exists; otherwise pick first meeting if available
      if (selectedMeetingId && list.some((m) => m.meeting_id === selectedMeetingId)) {
        return;
      }
      if (list.length > 0) setSelectedMeetingId(list[0].meeting_id);
      else setSelectedMeetingId("");
    } catch (e) {
      setErr(e.message || "Failed to load meetings");
      setMeetings([]);
      setSelectedMeetingId("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // When client changes, load meetings
    refreshMeetings({ preserveSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  async function onGenerate() {
    if (!canGenerate) return;

    setErr("");
    setGenerating(true);
    try {
      await generateTasks(selectedClientId, selectedMeetingId);

      // After generation, refresh to pull tasks_status/tasks/questions from DynamoDB.
      await refreshMeetings({ preserveSelection: true });
    } catch (e) {
      setErr(e.message || "Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  }

  async function onApprove() {
    if (!selectedClientId || !selectedMeetingId) return;

    setErr("");
    setApproving(true);
    try {
      await approveTasks(selectedClientId, selectedMeetingId);
      await refreshMeetings({ preserveSelection: true });
    } catch (e) {
      setErr(e.message || "Failed to approve tasks");
    } finally {
      setApproving(false);
    }
  }

  const tasksStatus = (selectedMeeting?.tasks_status || "NONE").toUpperCase();
  const transcriptStatus = (selectedMeeting?.transcript_status || "").toUpperCase();

  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ margin: "10px 0" }}>Tasks & Research Questions</h2>

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
            <label style={{ fontWeight: 600 }}>Meeting</label>

            <select
              value={selectedMeetingId || ""}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              disabled={loading || meetings.length === 0}
              style={{ padding: 10, minWidth: 360, maxWidth: "100%" }}
            >
              {meetings.length === 0 ? (
                <option value="" disabled>
                  {loading ? "Loading meetings..." : "No meetings found"}
                </option>
              ) : null}

              {meetings.map((m) => (
                <option key={m.meeting_id} value={m.meeting_id}>
                  {m.meeting_id} — transcript {String(m.transcript_status || "UNKNOWN")}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => refreshMeetings()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {err ? (
            <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>
          ) : null}

          {selectedMeeting ? (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <strong>Meeting ID:</strong> {selectedMeeting.meeting_id}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <strong>Transcript:</strong> {statusPill(selectedMeeting.transcript_status)}
                  </div>
                  <div>
                    <strong>Tasks:</strong>{" "}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        border: "1px solid #ddd",
                        background:
                          tasksStatus === "APPROVED"
                            ? "#e6f4ea"
                            : tasksStatus === "GENERATED"
                            ? "#eef3ff"
                            : "#eee",
                      }}
                    >
                      {tasksStatus}
                    </span>
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    <strong>Updated:</strong> {fmtDate(selectedMeeting.updated_at)}
                  </div>
                </div>

                {selectedMeeting.transcript_preview ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Transcript preview</div>
                    <div
                      style={{
                        padding: 10,
                        border: "1px solid #eee",
                        borderRadius: 8,
                        background: "#fafafa",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {selectedMeeting.transcript_preview}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={!canGenerate || generating}
                    title={
                      transcriptStatus !== "READY"
                        ? "Transcript must be READY before generating tasks."
                        : ""
                    }
                  >
                    {generating ? "Generating..." : "Generate tasks & questions"}
                  </button>

                  <button
                    type="button"
                    onClick={onApprove}
                    disabled={tasksStatus !== "GENERATED" || approving}
                    title={tasksStatus !== "GENERATED" ? "Generate tasks first." : ""}
                  >
                    {approving ? "Approving..." : "Approve"}
                  </button>
                </div>

                {(selectedMeeting.tasks && selectedMeeting.tasks.length > 0) ||
                (selectedMeeting.research_questions &&
                  selectedMeeting.research_questions.length > 0) ? (
                  <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                    {selectedMeeting.tasks && selectedMeeting.tasks.length > 0 ? (
                      <div>
                        <h3 style={{ margin: "0 0 8px 0" }}>Tasks</h3>
                        <ol style={{ margin: 0, paddingLeft: 18 }}>
                          {selectedMeeting.tasks.map((t, idx) => (
                            <li key={idx} style={{ marginBottom: 10 }}>
                              <div style={{ fontWeight: 700 }}>
                                {t.title || "(untitled task)"}
                              </div>
                              {t.description ? (
                                <div style={{ whiteSpace: "pre-wrap" }}>{t.description}</div>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {selectedMeeting.research_questions &&
                    selectedMeeting.research_questions.length > 0 ? (
                      <div>
                        <h3 style={{ margin: "0 0 8px 0" }}>Research questions</h3>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {selectedMeeting.research_questions.map((q, idx) => (
                            <li key={idx} style={{ marginBottom: 8 }}>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, opacity: 0.85 }}>
                    No tasks/questions stored yet. If transcript is READY, click “Generate”.
                  </div>
                )}

                {transcriptStatus !== "READY" ? (
                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
                    <strong>Note:</strong> You can only generate tasks when
                    <code> transcript_status </code>
                    is <code>READY</code>. Current: <code>{transcriptStatus || "UNKNOWN"}</code>
                  </div>
                ) : null}
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
