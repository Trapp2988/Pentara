import { useState } from "react";
import "./App.css";
import ClientSelector from "./components/ClientSelector";
import Recorder from "./components/Recorder";
import TasksTab from "./components/TasksTab";
import SpecSheetsTab from "./components/SpecSheetsTab";
import CodeTemplatesTab from "./components/CodeTemplatesTab";

export default function App() {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState("record"); // record | tasks | specs | templates

  return (
    <div>
      <h1>Pentara Meeting Assistant</h1>
      <p>Select a client (from DynamoDB), then record a meeting or generate tasks.</p>

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
            className={`tabBtn ${activeTab === "specs" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("specs")}
          >
            Spec Sheets
          </button>

          <button
            type="button"
            className={`tabBtn ${activeTab === "templates" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("templates")}
          >
            Code Templates
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
        ) : activeTab === "specs" ? (
          <SpecSheetsTab selectedClientId={selectedClientId} />
        ) : (
          <CodeTemplatesTab selectedClientId={selectedClientId} />
        )}
      </div>
    </div>
  );
}
