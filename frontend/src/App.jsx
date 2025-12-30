import { useState } from "react";
import "./App.css";
import ClientSelector from "./components/ClientSelector";
import Recorder from "./components/Recorder";
import TasksTab from "./components/TasksTab";

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState("record"); // "record" | "tasks"

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Pentara Meeting Assistant</h1>
      <p>Select a client (from DynamoDB), then record a meeting or generate tasks.</p>

      <ClientSelector
        value={selectedClientId}
        onChange={setSelectedClientId}
        disabled={false}
      />

      {/* Tabs */}
      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => setActiveTab("record")}
          style={{
            padding: "10px 14px",
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid #ccc",
            background: activeTab === "record" ? "#f2f2f2" : "#fff",
            cursor: "pointer",
          }}
        >
          Record
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          style={{
            padding: "10px 14px",
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid #ccc",
            background: activeTab === "tasks" ? "#f2f2f2" : "#fff",
            cursor: "pointer",
          }}
        >
          Tasks / Research Questions
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {activeTab === "record" ? (
          <Recorder selectedClientId={selectedClientId} />
        ) : (
          <TasksTab selectedClientId={selectedClientId} />
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <strong>Selected client_id:</strong> {selectedClientId || "(none)"}
      </div>
    </div>
  );
}
