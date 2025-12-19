import { useState } from "react";
import "./App.css";
import ClientSelector from "./components/ClientSelector";
import Recorder from "./components/Recorder";

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState("");

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Pentara Meeting Assistant</h1>
      <p>Select a client (from DynamoDB), then record a meeting.</p>

      <ClientSelector
        value={selectedClientId}
        onChange={setSelectedClientId}
        disabled={false}
      />

      <div style={{ marginTop: 24 }}>
        <Recorder selectedClientId={selectedClientId} />
      </div>

      <div style={{ marginTop: 18 }}>
        <strong>Selected client_id:</strong> {selectedClientId || "(none)"}
      </div>
    </div>
  );
}
