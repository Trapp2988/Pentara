import { useState } from "react";
import "./App.css";
import ClientSelector from "./components/ClientSelector";
import Recorder from "./components/Recorder";
import TasksTab from "./components/TasksTab";

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState("record"); // "record" | "tasks"

  return (
    <div>
      <h1>Pentara Meeting Assistant</h1>
      <p>Select a client (from DynamoDB), then record a meeting or generate tasks.</p>

      {/* Client selector panel */}
      <div className="panel">
        <div className="sectionTitle">Client</div>
        <div className="controlsRow">
          {/* ClientSelector already renders its own label + layout,
              but this wrapper forces the "white card" look consistently. */}
          <div style={{ width: "100%" }}>
            <ClientSelector
              value={selectedClientId}
              onChange={setSelectedClientId}
              disabled={false}
            />
          </div>
        </div>

        <div className="tabsRow">
          <div className="tabs">
            <button
              type="button"
              className={`tabBtn ${activeTab === "record" ? "tabBtnActive" : ""}`}
              onClick={() => setActiveTab("record")}
            >
              Record
            </button>

            <button
              type="button"
              className={`tabBtn ${activeTab === "tasks" ? "tabBtnActive" : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              Tasks / Research Questions
            </button>
          </div>
        </div>

        <div className="mt16 smallMuted">
          <strong>Selected client_id:</strong> {selectedClientId || "(none)"}
        </div>
      </div>

      {/* Main content panel */}
      <div className="panel mt20">
        {activeTab === "record" ? (
          <Recorder selectedClientId={selectedClientId} />
        ) : (
          <TasksTab selectedClientId={selectedClientId} />
        )}
      </div>
    </div>
  );
}
