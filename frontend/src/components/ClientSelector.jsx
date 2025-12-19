import React, { useEffect, useMemo, useState } from "react";
import { createClient, fetchClients } from "../api/clientsApi";

function slugPreview(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ClientSelector({ value, onChange, disabled }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const clientIdPreview = useMemo(() => slugPreview(displayName), [displayName]);

  async function refresh({ selectId } = {}) {
    setLoadErr("");
    setLoading(true);
    try {
      const list = await fetchClients();

      list.sort((a, b) =>
        (a.display_name || "").localeCompare(b.display_name || "", undefined, {
          sensitivity: "base",
        })
      );

      setClients(list);

      // If caller wants to select a specific id (after create), do it.
      if (selectId) {
        onChange?.(selectId);
      } else if (!value && list.length > 0) {
        // If nothing selected yet, auto-select first item.
        onChange?.(list[0].client_id);
      }
    } catch (e) {
      setLoadErr(e.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAdd() {
    setSaveErr("");
    setDisplayName("");
    setShowAdd(true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    setSaveErr("");

    const name = displayName.trim();
    if (!name) {
      setSaveErr("Display name is required.");
      return;
    }

    setSaving(true);
    try {
      // IMPORTANT: only send display_name; backend slugifies and enforces uniqueness.
      const newClient = await createClient({ display_name: name });

      setShowAdd(false);
      await refresh({ selectId: newClient.client_id });
    } catch (e) {
      setSaveErr(e.message || "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  const isDisabled = !!disabled || loading;

  return (
    <div style={{ marginTop: 20 }}>
      <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
        Client
      </label>

      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 520 }}>
        <select
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={isDisabled}
          style={{ padding: 10, flex: 1 }}
        >
          <option value="" disabled>
            {loading ? "Loading clients..." : "Select a client"}
          </option>

          {clients.map((c) => (
            <option key={c.client_id} value={c.client_id}>
              {c.display_name} ({c.client_id})
            </option>
          ))}
        </select>

        <button type="button" onClick={openAdd} disabled={disabled || loading}>
          Add Client
        </button>

        <button
          type="button"
          onClick={() => refresh()}
          disabled={disabled || loading}
        >
          Refresh
        </button>
      </div>

      {loadErr ? (
        <div style={{ color: "crimson", marginTop: 10 }}>{loadErr}</div>
      ) : null}

      {showAdd ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            maxWidth: 520,
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Add Client</strong>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              disabled={saving}
            >
              X
            </button>
          </div>

          <form
            onSubmit={submitAdd}
            style={{ display: "grid", gap: 10, marginTop: 10 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <label>Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter Client Name Here"
                style={{ padding: 10 }}
                disabled={saving}
              />
              <small style={{ opacity: 0.8 }}>
                Client ID will be:{" "}
                <code>{clientIdPreview || "(enter a name)"}</code>
              </small>
            </div>

            {saveErr ? <div style={{ color: "crimson" }}>{saveErr}</div> : null}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
