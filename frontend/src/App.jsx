import { useMemo, useState } from "react";
import "./App.css";

const CLIENTS = ["Client A", "Client B", "Client C"]; // placeholder

export default function App() {
  const [client, setClient] = useState(CLIENTS[0]);
  const [status, setStatus] = useState("idle"); // idle | recording | uploading

  const canRecord = useMemo(() => status !== "uploading", [status]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Pentara Meeting Assistant</h1>
      <p>
        Select a client, then record a meeting. (Recording & upload wiring comes
        next.)
      </p>

      <label style={{ display: "block", marginTop: 20, marginBottom: 8 }}>
        Client
      </label>
      <select
        value={client}
        onChange={(e) => setClient(e.target.value)}
        style={{ padding: 10, width: "100%", maxWidth: 420 }}
        disabled={status === "uploading"}
      >
        {CLIENTS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button
          disabled={!canRecord || status === "recording"}
          onClick={() => setStatus("recording")}
        >
          Start recording
        </button>

        <button
          disabled={status !== "recording"}
          onClick={() => setStatus("uploading")}
        >
          Stop & Upload
        </button>

        <button
          disabled={status === "idle"}
          onClick={() => setStatus("idle")}
        >
          Reset
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <strong>Status:</strong> {status}
        <br />
        <strong>Selected client:</strong> {client}
      </div>
    </div>
  );
}
