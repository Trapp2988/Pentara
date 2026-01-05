import { useState } from "react";
import "./App.css";
import ClientSelector from "./components/ClientSelector";
import Recorder from "./components/Recorder";
import TasksTab from "./components/TasksTab";
import DeliverablesTab from "./components/DeliverablesTab";

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState("record"); // record | tasks | deliverables

  return (
    <div>
      <h1>Pentara Meeting Assistant</h1>
      <p>Turn client meetings into structured tasks, spec sheets, and code templates.</p>

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

          <button
            type="button"
            className={`tabBtn ${activeTab === "deliverables" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("deliverables")}
          >
            Spec Sheet / Code Template
          </button>
        </div>
      </div>

      <div className="panel mt20">
        <div className="sectionTitle">Client</div>

        <ClientSelector
          value={selectedClientId}
          onChange={setSelectedClientId}
          disabled={false}
        />

        <div className="mt16 smallMuted">
          <strong>Selected client_id:</strong> {selectedClientId || "(none)"}
        </div>
      </div>

      <div className="panel mt20">
        {activeTab === "record" ? (
          <Recorder selectedClientId={selectedClientId} />
        ) : activeTab === "tasks" ? (
          <TasksTab selectedClientId={selectedClientId} />
        ) : (
          <DeliverablesTab selectedClientId={selectedClientId} />
        )}
      </div>
    </div>
  );
}

