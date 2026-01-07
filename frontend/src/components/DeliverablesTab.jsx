import React, { useEffect, useMemo, useState } from "react";
import { fetchMeetings } from "../api/meetingsApi";
import {
  approveDeliverables,
  clearDeliverables,
  fetchDeliverables,
  fetchDeliverableContent,
  generateDeliverables,
  reviseDeliverables,
  saveDeliverableContent,
} from "../api/deliverablesApi";

function withMeetingNumbers(meetings) {
  // Stable numbering: oldest meeting = #1, newest = #N
  const sortedAsc = [...(meetings || [])].sort((a, b) => {
    const ta = new Date(a.created_at || a.updated_at || 0).getTime();
    const tb = new Date(b.created_at || b.updated_at || 0).getTime();
    return ta - tb;
  });

  const idToNumber = new Map();
  sortedAsc.forEach((m, idx) => {
    idToNumber.set(m.meeting_id, idx + 1);
  });

  return (meetings || []).map((m) => ({
    ...m,
    meeting_number: idToNumber.get(m.meeting_id),
  }));
}

function meetingDateLabelFromIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}


function meetingDateLabel(meetingId) {
  // Expected: YYYYMMDDTHHMMSSZ-xxxxxxxx
  const m = String(meetingId || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/);
  if (!m) return null;

  const [_, yyyy, MM, dd, HH, mm, ss] = m;
  const dt = new Date(Date.UTC(+yyyy, +MM - 1, +dd, +HH, +mm, +ss));

  // Option 1: date only
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shortMeetingId(meetingId) {
  const s = String(meetingId || "");
  const parts = s.split("-");
  const tail = parts[parts.length - 1];
  // last segment is usually the 8-char suffix; fallback to last 8 of full string
  return tail && tail.length <= 12 ? tail : s.slice(-8);
}

function meetingLabel(m) {
  if (!m) return "";
  const date = meetingDateLabel(m.meeting_id) || m.meeting_id;
  const shortId = shortMeetingId(m.meeting_id);

  // Customize the right-hand “status” text per tab (examples below)
  return { date, shortId };
}


function formatMeetingDisplay(meeting) {
  // Option 1: "Jan 5, 2026 • Client Kickoff" (falls back if no label)
  const d = new Date(meeting.created_at || meeting.updated_at || "");
  const dateStr = isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const label = (meeting.meeting_label || "").trim();

  if (dateStr && label) return `${dateStr} • ${label}`;
  if (dateStr) return dateStr;              // fallback: just date
  if (label) return label;                  // fallback: just label
  return meeting.meeting_id;                // final fallback
}


function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function pill(text, kind = "neutral") {
  const bg =
    kind === "good"
      ? "#e6f4ea"
      : kind === "warn"
      ? "#fff4e5"
      : kind === "info"
      ? "#eef3ff"
      : kind === "bad"
      ? "#fde7e9"
      : "#eee";

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
      {(text || "").toUpperCase() || "UNKNOWN"}
    </span>
  );
}

function taskKey(taskIndex, language) {
  return `${String(taskIndex)}::${String(language || "R").toUpperCase()}`;
}

export default function DeliverablesTab({ selectedClientId }) {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [approving, setApproving] = useState(false);
  
  const [err, setErr] = useState("");

  const [language, setLanguage] = useState("R"); // used for "Generate" only (R|SAS|BOTH)
  const [aiInstructions, setAiInstructions] = useState("");

  // Per-task loaded content + drafts
  // { "1::R": { loaded: true, loading: false, spec: "...", template: "...", dirty: false, lastLoadedAt: iso } }
  const [taskDrafts, setTaskDrafts] = useState({});

  const [clearing, setClearing] = useState(false);
  const busy = generating || revising || approving || clearing;

  const selectedMeeting = useMemo(() => {
    return meetings.find((m) => m.meeting_id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  const tasksStatus = (selectedMeeting?.tasks_status || "NONE").toUpperCase();
  const deliverablesStatus = (selectedMeeting?.deliverables_status || "NONE").toUpperCase();
  const deliverablesLanguage = (selectedMeeting?.deliverables_language || "").toUpperCase();

  const canGenerate =
    !!selectedClientId &&
    !!selectedMeetingId &&
    tasksStatus === "APPROVED" &&
    !hasDeliverables;

  const canRevise =
    !!selectedClientId &&
    !!selectedMeetingId &&
    tasksStatus === "APPROVED" &&
    ["GENERATED", "REVISED", "APPROVED", "EDITED"].includes(deliverablesStatus);

  const specIndex = selectedMeeting?.spec_sheets || [];
  const hasDeliverables = specIndex.length > 0;

  async function refreshMeetings({ preserveSelection = true } = {}) {
    const cid = (selectedClientId || "").trim();
    if (!cid) {
      setMeetings([]);
      setSelectedMeetingId("");
      setTaskDrafts({});
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const list = await fetchMeetings(cid);
      setMeetings(withMeetingNumbers(list));

      if (!preserveSelection) {
        const firstId = list?.[0]?.meeting_id || "";
        setSelectedMeetingId(firstId);
        setTaskDrafts({});
        return;
      }

      let nextId = selectedMeetingId;
      if (!nextId || !list.some((m) => m.meeting_id === nextId)) {
        nextId = list.length > 0 ? list[0].meeting_id : "";
        setSelectedMeetingId(nextId);
        setTaskDrafts({});
      }
    } catch (e) {
      setErr(e.message || "Failed to load meetings");
      setMeetings([]);
      setSelectedMeetingId("");
      setTaskDrafts({});
    } finally {
      setLoading(false);
    }
  }

  async function hydrateDeliverablesIntoMeeting(meetingId) {
    if (!selectedClientId || !meetingId) return;
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
                last_deliverables_instructions: d.last_deliverables_instructions || "",
              }
            : m
        )
      );
      setAiInstructions(d.last_deliverables_instructions || "");
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    refreshMeetings({ preserveSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedMeetingId) hydrateDeliverablesIntoMeeting(selectedMeetingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeetingId]);

  async function onChangeMeeting(nextId) {
    // block if there are unsaved drafts
    const hasDirty = Object.values(taskDrafts).some((d) => d?.dirty);
    if (hasDirty) {
      const ok = window.confirm(
        "You have unsaved spec sheet/code template edits. Switching meetings will discard them. Continue?"
      );
      if (!ok) return;
    }

    setSelectedMeetingId(nextId);
    setErr("");
    setTaskDrafts({});
    setAiInstructions("");
    await hydrateDeliverablesIntoMeeting(nextId);
  }

  async function onGenerate() {
    if (!canGenerate) return;
    setErr("");
    setGenerating(true);
    try {
      await generateDeliverables(selectedClientId, selectedMeetingId, language);
      await refreshMeetings({ preserveSelection: true });
      await hydrateDeliverablesIntoMeeting(selectedMeetingId);
      setTaskDrafts({});
    } catch (e) {
      setErr(e.message || "Failed to generate spec sheet/code template");
    } finally {
      setGenerating(false);
    }
  }

  async function onClearGeneration() {
    if (!selectedClientId || !selectedMeetingId) return;
  
    const hasDirty = Object.values(taskDrafts).some((d) => d?.dirty);
    if (hasDirty) {
      setErr("You have unsaved edits. Save drafts before clearing generation.");
      return;
    }
  
    const ok = window.confirm(
      "Clear generated spec sheets and code templates for this meeting? This deletes the generated files in S3 so you can regenerate from updated tasks."
    );
    if (!ok) return;
  
    setErr("");
    setClearing(true);
    try {
      await clearDeliverables(selectedClientId, selectedMeetingId);
      await refreshMeetings({ preserveSelection: true });
      await hydrateDeliverablesIntoMeeting(selectedMeetingId);
      setTaskDrafts({});
      setAiInstructions("");
    } catch (e) {
      setErr(e.message || "Failed to clear generation");
    } finally {
      setClearing(false);
    }
  }


  async function onReviseWithAI() {
    if (!canRevise) return;

    const ins = (aiInstructions || "").trim();
    if (!ins) {
      setErr("Please enter instructions for the AI (what to change).");
      return;
    }

    const hasDirty = Object.values(taskDrafts).some((d) => d?.dirty);
    if (hasDirty) {
      const ok = window.confirm(
        "You have unsaved edits. Revise with AI will overwrite S3 spec sheet/code template using the saved versions. Save drafts first if you want to keep them. Continue?"
      );
      if (!ok) return;
    }

    setErr("");
    setRevising(true);
    try {
      await reviseDeliverables(selectedClientId, selectedMeetingId, ins);
      await refreshMeetings({ preserveSelection: true });
      await hydrateDeliverablesIntoMeeting(selectedMeetingId);
      setTaskDrafts({});
    } catch (e) {
      setErr(e.message || "Failed to revise spec sheet/code template");
    } finally {
      setRevising(false);
    }
  }

  async function onApprove() {
    if (!selectedClientId || !selectedMeetingId) return;

    const hasDirty = Object.values(taskDrafts).some((d) => d?.dirty);
    if (hasDirty) {
      setErr("You have unsaved edits. Save drafts before approving.");
      return;
    }

    if (!hasDeliverables) {
      setErr("Generate deliverables first (no spec sheets exist yet).");
      return;
    }

    setErr("");
    setApproving(true);
    try {
      await approveDeliverables(selectedClientId, selectedMeetingId);
      await refreshMeetings({ preserveSelection: true });
      await hydrateDeliverablesIntoMeeting(selectedMeetingId);
    } catch (e) {
      setErr(e.message || "Failed to approve spec sheet/code tempalte");
    } finally {
      setApproving(false);
    }
  }

  async function loadTask(taskIndex, templateLang) {
    if (!selectedClientId || !selectedMeetingId) return;

    const key = taskKey(taskIndex, templateLang);
    setTaskDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), loading: true, loaded: true, dirty: false },
    }));

    setErr("");
    try {
      const d = await fetchDeliverableContent(
        selectedClientId,
        selectedMeetingId,
        taskIndex,
        templateLang
      );

      setTaskDrafts((prev) => ({
        ...prev,
        [key]: {
          loaded: true,
          loading: false,
          dirty: false,
          spec: d?.spec?.content ?? "",
          template: d?.template?.content ?? "",
          specKey: d?.spec?.s3_key,
          templateKey: d?.template?.s3_key,
          lastLoadedAt: new Date().toISOString(),
        },
      }));
    } catch (e) {
      setErr(e.message || "Failed to load task spec sheet/code template");
      setTaskDrafts((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), loading: false },
      }));
    }
  }

  function updateDraft(taskIndex, templateLang, patch) {
    const key = taskKey(taskIndex, templateLang);
    setTaskDrafts((prev) => {
      const cur = prev[key] || { loaded: true, loading: false, spec: "", template: "", dirty: false };
      return {
        ...prev,
        [key]: {
          ...cur,
          ...patch,
          dirty: true,
        },
      };
    });
  }

  async function saveTask(taskIndex, templateLang) {
    if (!selectedClientId || !selectedMeetingId) return;

    const key = taskKey(taskIndex, templateLang);
    const cur = taskDrafts[key];
    if (!cur) return;

    setErr("");
    setTaskDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], saving: true },
    }));

    try {
      await saveDeliverableContent(selectedClientId, selectedMeetingId, {
        task_index: taskIndex,
        language: String(templateLang || "R").toUpperCase(),
        spec_content: cur.spec ?? "",
        template_content: cur.template ?? "",
      });

      // mark clean + refresh top-level meeting metadata
      setTaskDrafts((prev) => ({
        ...prev,
        [key]: { ...prev[key], saving: false, dirty: false },
      }));

      await refreshMeetings({ preserveSelection: true });
      await hydrateDeliverablesIntoMeeting(selectedMeetingId);
    } catch (e) {
      setErr(e.message || "Failed to save deliverable edits");
      setTaskDrafts((prev) => ({
        ...prev,
        [key]: { ...prev[key], saving: false },
      }));
    }
  }

  function defaultTemplateLangForMeeting() {
    // If deliverables_language is BOTH, default to R in UI (user can switch per task)
    if (deliverablesLanguage === "SAS") return "SAS";
    return "R";
  }

  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ margin: "10px 0" }}>Spec Sheet & Code Template</h2>

      {!selectedClientId ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Select a client to view meetings.
        </div>
      ) : (
        <>
           {/* Instructions (top of Deliverables tab) */}
            <div className="instructionsBox">
              <strong>Instructions</strong>
              <ol>
                <li>Tasks must be approved before generating spec sheet/code template.</li>
                <li>Select the programming language (R or SAS).</li>
                <li>Generate spec sheets and code templates for each task.</li>
                <li>Edit spec sheet/code template directly in the app if needed.</li>
                <li>Approve spec sheet/code template when finalized.</li>
              </ol>
            </div>
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

              {meetings.map((m) => {
                const dateLabel = meetingDateLabel(m.meeting_id) || meetingDateLabelFromIso(m.created_at || m.updated_at) || "Meeting";
                const n = m.meeting_number || "?";
                
                return (
                  <option key={m.meeting_id} value={m.meeting_id}>
                    {dateLabel} • meeting #{n} — tasks {String(m.tasks_status || "NONE")}
                  </option>
                );
              })}
            </select>

            <button type="button" onClick={() => refreshMeetings()} disabled={loading || busy}>
              {loading ? "Refreshing..." : "Refresh"}
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
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>Meeting:</strong>{" "}
                  {formatMeetingDisplay(selectedMeeting)}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <strong>Tasks:</strong>{" "}
                    {tasksStatus === "APPROVED" ? pill(tasksStatus, "good") : pill(tasksStatus, "warn")}
                  </div>
                  <div>
                    <strong>Deliverables:</strong>{" "}
                    {deliverablesStatus === "APPROVED"
                      ? pill(deliverablesStatus, "good")
                      : deliverablesStatus === "GENERATED" ||
                        deliverablesStatus === "REVISED" ||
                        deliverablesStatus === "EDITED"
                      ? pill(deliverablesStatus, "info")
                      : pill(deliverablesStatus, "neutral")}
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    <strong>Language:</strong> {selectedMeeting.deliverables_language || "(not set)"}
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    <strong>Updated:</strong> {fmtDate(selectedMeeting.updated_at)}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  <label style={{ fontWeight: 700, alignSelf: "center" }}>Generate language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={busy || tasksStatus !== "APPROVED"}
                    style={{ padding: 10, minWidth: 220 }}
                  >
                    <option value="R">R</option>
                    <option value="SAS">SAS</option>
                    <option value="BOTH">BOTH (separate files)</option>
                  </select>

                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={!canGenerate || busy}
                    title={tasksStatus !== "APPROVED" ? "Approve tasks first." : ""}
                  >
                    {generating ? "Generating..." : "Generate spec sheets and code templates"}
                  </button>

                  <button
                    type="button"
                    onClick={onClearGeneration}
                    disabled={busy || !selectedMeetingId || !hasDeliverables}
                    title={!hasDeliverables ? "Nothing to clear yet." : ""}
                  >
                    {clearing ? "Clearing..." : "Clear generation"}
                  </button>
                  
                  <button
                    type="button"
                    onClick={onApprove}
                    disabled={busy || !selectedMeetingId || !hasDeliverables}
                    title={!hasDeliverables ? "Generate deliverables first." : ""}
                  >
                    {approving ? "Apporving..." : "Approve deliverables"}
                  </button>
                </div>

                {/* AI revision prompt */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>AI revision prompt</div>
                  <textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="Example: Add QC checks section to each spec. Keep templates as TODO/comment skeletons only."
                    rows={4}
                    style={{
                      width: "100%",
                      padding: 10,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      resize: "vertical",
                    }}
                    disabled={busy || tasksStatus !== "APPROVED"}
                  />

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={onReviseWithAI}
                      disabled={busy || tasksStatus !== "APPROVED" || !aiInstructions.trim()}
                    >
                      {revising ? "Revising..." : "Revise with AI"}
                    </button>
                    <div style={{ fontSize: 13, opacity: 0.85, alignSelf: "center" }}>
                      If you edited locally, save drafts before revising with AI.
                    </div>
                  </div>
                </div>

                {/* Tasks list with inline editors */}
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: 0 }}>Tasks</h3>

                  {specIndex.length === 0 ? (
                    <div style={{ marginTop: 8, opacity: 0.85 }}>
                      No spec sheet or code templates yet. Approve tasks, then Generate.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
                      {specIndex.map((s) => {
                        const ti = Number(s.task_index);
                        const title = s.task_title || "";
                        const defaultLang = defaultTemplateLangForMeeting();
                        const langKey = taskKey(ti, defaultLang);
                        const draft = taskDrafts[langKey] || null;

                        return (
                          <div
                            key={s.s3_key}
                            style={{
                              border: "1px solid #eee",
                              borderRadius: 12,
                              padding: 12,
                              background: "#fafafa",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <div style={{ fontWeight: 900 }}>
                                Task {String(ti).padStart(2, "0")}: {title}
                              </div>

                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                {deliverablesLanguage === "BOTH" ? (
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={{ fontSize: 13, opacity: 0.85 }}>Template</span>
                                    <select
                                      value={defaultLang}
                                      disabled
                                      style={{ padding: 8 }}
                                      title="For BOTH language meetings, this UI defaults to R. You can extend this to allow per-task switching."
                                    >
                                      <option value="R">R</option>
                                      <option value="SAS">SAS</option>
                                    </select>
                                  </div>
                                ) : null}

                                <button
                                  type="button"
                                  className="btnSecondary"
                                  onClick={() => loadTask(ti, defaultLang)}
                                  disabled={busy || draft?.loading}
                                >
                                  {draft?.loading ? "Loading..." : draft?.loaded ? "Reload" : "Load"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => saveTask(ti, defaultLang)}
                                  disabled={busy || !draft?.loaded || !draft?.dirty || draft?.saving}
                                  title={!draft?.dirty ? "No unsaved edits." : ""}
                                >
                                  {draft?.saving ? "Saving..." : "Save draft"}
                                </button>

                                {draft?.dirty ? (
                                  <span style={{ fontSize: 13, opacity: 0.85 }}>Unsaved edits</span>
                                ) : null}
                              </div>
                            </div>

                            {!draft?.loaded ? (
                              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                                Click <strong>Load</strong> to fetch spec + template content from S3 and edit inline.
                              </div>
                            ) : (
                              <div
                                style={{
                                  marginTop: 12,
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: 12,
                                }}
                              >
                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontWeight: 800 }}>Spec Sheet (Markdown)</div>
                                  <textarea
                                    value={draft?.spec ?? ""}
                                    onChange={(e) => updateDraft(ti, defaultLang, { spec: e.target.value })}
                                    rows={14}
                                    style={{
                                      width: "100%",
                                      padding: 10,
                                      border: "1px solid #ddd",
                                      borderRadius: 10,
                                      resize: "vertical",
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      background: "#fff",
                                    }}
                                    disabled={draft?.saving}
                                  />
                                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    S3: <code>{draft?.specKey}</code>
                                  </div>
                                </div>

                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ fontWeight: 800 }}>Code Template ({defaultLang})</div>
                                  <textarea
                                    value={draft?.template ?? ""}
                                    onChange={(e) => updateDraft(ti, defaultLang, { template: e.target.value })}
                                    rows={14}
                                    style={{
                                      width: "100%",
                                      padding: 10,
                                      border: "1px solid #ddd",
                                      borderRadius: 10,
                                      resize: "vertical",
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      background: "#fff",
                                    }}
                                    disabled={draft?.saving}
                                  />
                                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    S3: <code>{draft?.templateKey}</code>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {tasksStatus !== "APPROVED" ? (
                  <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
                    <strong>Note:</strong> You can only generate deliverables when{" "}
                    <code>tasks_status</code> is <code>APPROVED</code>. Current: <code>{tasksStatus}</code>
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
