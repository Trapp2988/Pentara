import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  approveTasks,
  fetchMeetings,
  generateTasks,
  reviseTasks,
  saveTasks,
  clearTasks, // NEW
} from "../api/meetingsApi";

function parseMeetingId(meetingId) {
  // Expected: YYYYMMDDTHHMMSSZ-xxxxxxxx
  if (!meetingId || typeof meetingId !== "string") return { date: null, suffix: "" };

  const [stamp, suffixRaw] = meetingId.split("-");
  const suffix = suffixRaw || "";

  // stamp like: 20260102T200740Z
  if (!stamp || stamp.length < 16 || stamp[8] !== "T") return { date: null, suffix };

  const yyyy = Number(stamp.slice(0, 4));
  const MM = Number(stamp.slice(4, 6));
  const dd = Number(stamp.slice(6, 8));
  const hh = Number(stamp.slice(9, 11));
  const mm = Number(stamp.slice(11, 13));
  const ss = Number(stamp.slice(13, 15));

  if ([yyyy, MM, dd, hh, mm, ss].some((n) => Number.isNaN(n))) return { date: null, suffix };

  // Meeting IDs are in UTC because they end with "Z"
  const date = new Date(Date.UTC(yyyy, MM - 1, dd, hh, mm, ss));
  return { date, suffix };
}

function formatMeetingLabel(meeting) {
  const id = meeting?.meeting_id;
  if (!id) return "";

  const { date } = parseMeetingId(id);
  const nice = date
    ? date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : id;

  const n = meeting?.meeting_number;
  return n ? `${nice} • meeting #${n}` : nice;
}

function formatMeetingIdShort(meeting) {
  const id = meeting?.meeting_id;
  if (!id) return "";

  const { date } = parseMeetingId(id);
  const nice = date
    ? date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : id;

  const n = meeting?.meeting_number;
  return n ? `${nice} • meeting #${n}` : nice;
}

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

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((t) => ({
    title: (t?.title || "").toString(),
    description: (t?.description || "").toString(),
  }));
}

function deepEqualJson(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Adds UI-only meeting_number per client:
 * oldest = #1, newest = #N (based on created_at/updated_at fallback to meeting_id timestamp)
 */
function withMeetingNumbers(meetings) {
  const list = Array.isArray(meetings) ? meetings : [];

  function ts(m) {
    const t1 = new Date(m?.created_at || "").getTime();
    if (!Number.isNaN(t1) && t1 > 0) return t1;

    const t2 = new Date(m?.updated_at || "").getTime();
    if (!Number.isNaN(t2) && t2 > 0) return t2;

    const { date } = parseMeetingId(m?.meeting_id || "");
    const t3 = date ? date.getTime() : 0;
    return t3 || 0;
  }

  const sortedAsc = [...list].sort((a, b) => ts(a) - ts(b));
  const idToNum = new Map();
  sortedAsc.forEach((m, idx) => {
    if (m?.meeting_id) idToNum.set(m.meeting_id, idx + 1);
  });

  return list.map((m) => ({
    ...m,
    meeting_number: idToNum.get(m.meeting_id),
  }));
}

export default function TasksTab({ selectedClientId }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  // Actions
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [clearing, setClearing] = useState(false); // NEW

  // Editable draft state
  const [draftTasks, setDraftTasks] = useState([]);
  const [aiInstructions, setAiInstructions] = useState("");

  // Track the last-loaded server version to detect unsaved edits
  const baselineRef = useRef({ tasks: [] });

  const selectedMeeting = useMemo(() => {
    return meetings.find((m) => m.meeting_id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  const transcriptStatus = (selectedMeeting?.transcript_status || "").toUpperCase();
  const tasksStatus = (selectedMeeting?.tasks_status || "NONE").toUpperCase();

  const hasServerOutputs = useMemo(() => {
    const t = selectedMeeting?.tasks || [];
    return Array.isArray(t) && t.length > 0;
  }, [selectedMeeting]);

  // IMPORTANT CHANGE:
  // Only allow Generate when transcript is READY AND there are no tasks stored yet.
  // This prevents the "generate again" error path entirely.
  const canGenerate = useMemo(() => {
    return (
      !!selectedClientId &&
      !!selectedMeetingId &&
      transcriptStatus === "READY" &&
      !hasServerOutputs
    );
  }, [selectedClientId, selectedMeetingId, transcriptStatus, hasServerOutputs]);

  // Allow approving after any “generated by AI” or “edited” state
  const canApprove = useMemo(() => {
    return ["GENERATED", "REVISED", "EDITED", "APPROVED"].includes(tasksStatus);
  }, [tasksStatus]);

  const dirty = useMemo(() => {
    const base = baselineRef.current;
    return !deepEqualJson(draftTasks, base.tasks);
  }, [draftTasks]);

  function loadDraftFromMeeting(meeting) {
    const serverTasks = normalizeTasks(meeting?.tasks || []);
    baselineRef.current = { tasks: serverTasks };
    setDraftTasks(serverTasks);
    setAiInstructions(meeting?.last_instructions || "");
  }

  async function refreshMeetings({ preserveSelection = true } = {}) {
    const cid = (selectedClientId || "").trim();
    if (!cid) {
      setMeetings([]);
      setSelectedMeetingId("");
      setDraftTasks([]);
      baselineRef.current = { tasks: [] };
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const raw = await fetchMeetings(cid);
      const list = withMeetingNumbers(raw);
      setMeetings(list);

      if (!preserveSelection) {
        setSelectedMeetingId("");
        setDraftTasks([]);
        baselineRef.current = { tasks: [] };
        return;
      }

      // Keep selection if it still exists; otherwise pick first meeting if available
      let nextId = selectedMeetingId;
      if (!nextId || !list.some((m) => m.meeting_id === nextId)) {
        nextId = list.length > 0 ? list[0].meeting_id : "";
        setSelectedMeetingId(nextId);
      }

      if (nextId) {
        const m = list.find((x) => x.meeting_id === nextId) || null;
        loadDraftFromMeeting(m);
      } else {
        setDraftTasks([]);
        baselineRef.current = { tasks: [] };
      }
    } catch (e) {
      setErr(e.message || "Failed to load meetings");
      setMeetings([]);
      setSelectedMeetingId("");
      setDraftTasks([]);
      baselineRef.current = { tasks: [] };
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMeetings({ preserveSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  async function onChangeMeeting(nextMeetingId) {
    if (dirty) {
      const ok = window.confirm(
        "You have unsaved edits. Switching meetings will discard them. Continue?"
      );
      if (!ok) return;
    }
    setSelectedMeetingId(nextMeetingId);

    const m = meetings.find((x) => x.meeting_id === nextMeetingId) || null;
    loadDraftFromMeeting(m);
  }

  async function onGenerate() {
    if (!selectedClientId || !selectedMeetingId) return;

    // Guard: if tasks exist, force user to clear first.
    if (hasServerOutputs) {
      setErr("Tasks already exist for this meeting. Click “Clear tasks” before generating again.");
      return;
    }

    if (transcriptStatus !== "READY") return;

    setErr("");
    setGenerating(true);
    try {
      await generateTasks(selectedClientId, selectedMeetingId);
      await refreshMeetings({ preserveSelection: true });
    } catch (e) {
      setErr(e.message || "Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  }

  async function onClearTasks() {
    if (!selectedClientId || !selectedMeetingId) return;

    if (dirty) {
      const ok = window.confirm(
        "You have unsaved edits. Clearing tasks will discard them. Continue?"
      );
      if (!ok) return;
    }

    const ok = window.confirm(
      "Clear tasks for this meeting? This removes the stored tasks and resets task status."
    );
    if (!ok) return;

    setErr("");
    setClearing(true);
    try {
      await clearTasks(selectedClientId, selectedMeetingId);
      await refreshMeetings({ preserveSelection: true });
    } catch (e) {
      setErr(e.message || "Failed to clear tasks");
    } finally {
      setClearing(false);
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

  async function onSaveEdits() {
    if (!selectedClientId || !selectedMeetingId) return;

    setErr("");
    setSaving(true);
    try {
      const cleanedTasks = (draftTasks || [])
        .map((t) => ({
          title: (t.title || "").trim(),
          description: (t.description || "").trim(),
        }))
        .filter((t) => t.title || t.description);

      await saveTasks(selectedClientId, selectedMeetingId, cleanedTasks);

      await refreshMeetings({ preserveSelection: true });
    } catch (e) {
      setErr(e.message || "Failed to save edits");
    } finally {
      setSaving(false);
    }
  }

  async function onReviseWithAI() {
    if (!selectedClientId || !selectedMeetingId) return;

    const ins = (aiInstructions || "").trim();
    if (!ins) {
      setErr("Please enter instructions for the AI (what to change).");
      return;
    }

    if (dirty) {
      const ok = window.confirm(
        "You have unsaved edits. Revise with AI will use the CURRENT saved version in DynamoDB, not your unsaved draft. Save edits first?"
      );
      if (ok) {
        await onSaveEdits();
      }
    }

    setErr("");
    setRevising(true);
    try {
      await reviseTasks(selectedClientId, selectedMeetingId, ins);
      await refreshMeetings({ preserveSelection: true });
    } catch (e) {
      setErr(e.message || "Failed to revise with AI");
    } finally {
      setRevising(false);
    }
  }

  // Draft editing helpers
  function updateTask(idx, patch) {
    setDraftTasks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function addTask() {
    setDraftTasks((prev) => [...prev, { title: "", description: "" }]);
  }

  function removeTask(idx) {
    setDraftTasks((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetDraftToServer() {
    if (!selectedMeeting) return;
    loadDraftFromMeeting(selectedMeeting);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ margin: "10px 0" }}>Tasks</h2>

      {!selectedClientId ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Select a client to view meetings.
        </div>
      ) : (
        <>
          {/* Instructions (top of Tasks tab) */}
          <div className="instructionsBox">
            <strong>Instructions</strong>
            <ol>
              <li>Select a meeting with a completed transcript.</li>
              <li>Click Generate tasks.</li>
              <li>Review/edit tasks.</li>
              <li>Approve tasks to unlock deliverables (spec sheets + code templates).</li>
            </ol>
          </div>

          {/* Meeting selector row */}
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
                  {formatMeetingLabel(m)} — transcript {m.transcript_status}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => refreshMeetings()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {dirty ? <span style={{ fontSize: 13, opacity: 0.85 }}>Unsaved changes</span> : null}
          </div>

          {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

          {/* Meeting details + actions */}
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
                  <strong>Meeting:</strong> {formatMeetingIdShort(selectedMeeting)}
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
                            : tasksStatus === "GENERATED" ||
                              tasksStatus === "REVISED" ||
                              tasksStatus === "EDITED"
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
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Transcript preview</div>
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

                {/* Generate / Approve / Clear */}
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={!canGenerate || generating || clearing}
                    title={
                      transcriptStatus !== "READY"
                        ? "Transcript must be READY before generating tasks."
                        : hasServerOutputs
                        ? "Tasks already exist. Clear tasks first."
                        : ""
                    }
                  >
                    {generating ? "Generating..." : "Generate tasks"}
                  </button>

                  {hasServerOutputs ? (
                    <button
                      type="button"
                      onClick={onClearTasks}
                      disabled={clearing || generating || saving || revising}
                      title="Clears stored tasks so you can generate again cleanly."
                      style={{ background: "#fff", border: "1px solid #d33", color: "#d33" }}
                    >
                      {clearing ? "Clearing..." : "Clear tasks"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={onApprove}
                    disabled={!canApprove || approving || clearing}
                    title={!canApprove ? "Generate/revise/edit tasks first." : ""}
                  >
                    {approving ? "Approving..." : "Approve"}
                  </button>

                  {dirty ? (
                    <button type="button" onClick={resetDraftToServer} disabled={saving || revising || clearing}>
                      Reset draft
                    </button>
                  ) : null}
                </div>

                {/* If no outputs yet */}
                {!hasServerOutputs ? (
                  <div style={{ marginTop: 10, opacity: 0.85 }}>
                    No tasks stored yet. If transcript is READY, click “Generate”.
                  </div>
                ) : (
                  <>
                    {/* AI revision instructions */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>AI revision prompt</div>
                      <textarea
                        value={aiInstructions}
                        onChange={(e) => setAiInstructions(e.target.value)}
                        placeholder="Example: Make the tasks more specific and add assumptions where needed."
                        rows={4}
                        style={{
                          width: "100%",
                          padding: 10,
                          border: "1px solid #ddd",
                          borderRadius: 8,
                          resize: "vertical",
                        }}
                        disabled={revising || clearing}
                      />

                      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={onReviseWithAI}
                          disabled={revising || clearing || !aiInstructions.trim()}
                        >
                          {revising ? "Revising..." : "Revise with AI"}
                        </button>

                        <button
                          type="button"
                          onClick={onSaveEdits}
                          disabled={saving || clearing || !dirty}
                          title={!dirty ? "No unsaved edits." : ""}
                        >
                          {saving ? "Saving..." : "Save edits"}
                        </button>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                        Tip: Iterate—Revise with AI, then manual edit, then Save, then revise again.
                      </div>
                    </div>

                    {/* Editable Tasks */}
                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <h3 style={{ margin: 0 }}>Tasks (editable)</h3>
                        <button type="button" onClick={addTask} disabled={saving || revising || clearing}>
                          + Add task
                        </button>
                      </div>

                      {draftTasks.length === 0 ? (
                        <div style={{ marginTop: 8, opacity: 0.85 }}>
                          No tasks in draft. Add one, or revise with AI.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                          {draftTasks.map((t, idx) => (
                            <div
                              key={idx}
                              style={{
                                border: "1px solid #eee",
                                borderRadius: 10,
                                padding: 12,
                                background: "#fafafa",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontWeight: 800 }}>Task {idx + 1}</div>
                                <button
                                  type="button"
                                  onClick={() => removeTask(idx)}
                                  className="btnSecondary"
                                  disabled={saving || revising || clearing}
                                >
                                  Remove
                                </button>
                              </div>

                              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <label style={{ fontWeight: 700 }}>Title</label>
                                  <input
                                    value={t.title}
                                    onChange={(e) => updateTask(idx, { title: e.target.value })}
                                    placeholder="Task title"
                                    disabled={saving || revising || clearing}
                                  />
                                </div>

                                <div style={{ display: "grid", gap: 6 }}>
                                  <label style={{ fontWeight: 700 }}>Description</label>
                                  <textarea
                                    value={t.description}
                                    onChange={(e) => updateTask(idx, { description: e.target.value })}
                                    placeholder="Task description"
                                    rows={3}
                                    style={{
                                      width: "100%",
                                      padding: 10,
                                      border: "1px solid #ddd",
                                      borderRadius: 8,
                                      resize: "vertical",
                                    }}
                                    disabled={saving || revising || clearing}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {transcriptStatus !== "READY" ? (
                  <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
                    <strong>Note:</strong> You can only generate tasks when{" "}
                    <code>transcript_status</code> is <code>READY</code>. Current:{" "}
                    <code>{transcriptStatus || "UNKNOWN"}</code>
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
