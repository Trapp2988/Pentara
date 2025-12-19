import { useMemo, useState } from "react";
import "./App.css";
import ClientSelector from "./components/ClientSelector";

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [status, setStatus] = useState("idle"); // idle | recording | uploading

  // Don’t allow switching clients mid-recording/upload
  const lockClient = useMemo(
    () => status === "recording" || status === "uploading",
    [status]
  );

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Pentara Meeting Assistant</h1>
      <p>Select a client (from DynamoDB), then record a meeting.</p>

      <ClientSelector
        value={selectedClientId}
        onChange={setSelectedClientId}
        disabled={lockClient}
      />

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button
          disabled={lockClient || !selectedClientId}
          onClick={() => setStatus("recording")}
        >
          Start recording
        </button>

        <button
          disabled={status !== "recording"}
          onClick={() => setStatus("uploading")}
        >
          Stop & Upload (next)
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
        <strong>Selected client_id:</strong> {selectedClientId || "(none)"}
      </div>
    </div>
  );
}

