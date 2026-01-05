import React, { useRef, useState } from "react";

function pickBestMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

export default function Recorder({ selectedClientId }) {
  const [status, setStatus] = useState("idle"); // idle | prompting | recording | uploading | stopped | error
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [uploadedKey, setUploadedKey] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const screenStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const mixedStreamRef = useRef(null);

  async function getUploadUrl(contentType) {
    const base = import.meta.env.VITE_CLIENTS_API_BASE_URL?.replace(/\/+$/, "");
    if (!base) throw new Error("Missing VITE_CLIENTS_API_BASE_URL");

    const res = await fetch(`${base}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClientId,
        content_type: contentType || "video/webm",
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to get upload URL (${res.status})`);
    return data; // { upload_url, key, content_type, ... }
  }

  async function startRecording() {
    setError("");
    setUploadedKey("");
    setDownloadUrl("");
    setFilename("");

    if (!selectedClientId) {
      setError("Select a client first.");
      return;
    }

    try {
      setStatus("prompting");

      // 1) Capture the tab/screen. audio:true is REQUIRED for “Share tab audio” to appear.
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      screenStreamRef.current = screenStream;

      const tabAudioTracks = screenStream.getAudioTracks();
      const hasTabAudio = tabAudioTracks.length > 0;

      // 2) Capture mic (optional). If denied, we still proceed with tab audio.
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
      } catch {
        micStream = null;
      }
      micStreamRef.current = micStream;

      // 3) Mix tab audio + mic into ONE track.
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();

      if (hasTabAudio) {
        const tabAudioSource = audioContext.createMediaStreamSource(
          new MediaStream([tabAudioTracks[0]])
        );
        tabAudioSource.connect(destination);
      }

      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      const videoTrack = screenStream.getVideoTracks()[0];
      const mixedAudioTrack = destination.stream.getAudioTracks()[0]; // may be undefined

      const finalTracks = [videoTrack];
      if (mixedAudioTrack) finalTracks.push(mixedAudioTrack);

      const mixedStream = new MediaStream(finalTracks);
      mixedStreamRef.current = mixedStream;

      // 4) Create MediaRecorder
      const mimeType = pickBestMimeType();
      const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });

        // Optional: keep local download link for debugging
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const localName = `${selectedClientId}-meeting-${ts}.webm`;
        setFilename(localName);

        try {
          setStatus("uploading");

          // 1) get presigned URL
          const { upload_url, key, content_type } = await getUploadUrl(blob.type || "video/webm");

          // 2) PUT blob to S3
          const put = await fetch(upload_url, {
            method: "PUT",
            headers: { "Content-Type": content_type },
            body: blob,
          });

          if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);

          setUploadedKey(key);
          setStatus("stopped");
        } catch (e) {
          setStatus("stopped");
          setError(e?.message || String(e));
        }
      };

      recorder.start(1000);
      setStatus("recording");

      if (!hasTabAudio) {
        setError(
          "Recording started, but TAB audio was not detected. In the share picker, choose the Google Meet TAB and enable 'Share tab audio', then stop and try again."
        );
      }
    } catch (e) {
      setStatus("error");
      setError(e?.message || String(e));
      cleanupStreams();
    }
  }

  function stopRecording() {
    try {
      setStatus("stopping");
      recorderRef.current?.stop();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      cleanupStreams();
    }
  }

  function cleanupStreams() {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    mixedStreamRef.current = null;
  }

  function download() {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename || "meeting-recording.webm";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const isRecording = status === "recording" || status === "prompting";
  const canStart = !isRecording && status !== "uploading" && !!selectedClientId;
  const canStop = status === "recording";
  const canDownload = !!downloadUrl;

  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ margin: "10px 0" }}>Record</h2>
    
      {!selectedClientId ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          Select a client to start recording.
        </div>
      ) : (
        <>
          {/* Instructions (top of Record tab) */}
          <div className="instructionsBox" style={{ marginBottom: 12 }}>
            <strong>Instructions</strong>
            <ol>
              <li>Click <b>Start Recording</b></li>
              <li>In the picker, choose <b>Chrome Tab</b></li>
              <li>Select the <b>Google Meet</b> tab</li>
              <li>Enable <b>Share tab audio</b></li>
              <li>Click <b>Share</b></li>
              <li>When finished, click <b>Stop</b> to upload and transcribe</li>
            </ol>
    
            <div className="smallMuted" style={{ marginTop: 6 }}>
              Tip: If you don’t see “Share tab audio,” you likely selected “Window” instead of “Chrome Tab.”
            </div>
          </div>
    
          {/* Main recorder card */}
          <div
            style={{
              maxWidth: 720,
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Meeting Recorder</h3>
    
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={startRecording} disabled={!canStart}>
                Start Recording
              </button>
    
              <button onClick={stopRecording} disabled={!canStop}>
                Stop
              </button>
    
              <button onClick={download} disabled={!canDownload} className="btnSecondary">
                Download (optional)
              </button>
            </div>
    
            <div style={{ marginTop: 12 }}>
              <div>
                <b>Status:</b> {status}
              </div>
    
              {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}
    
              {uploadedKey ? (
                <div style={{ marginTop: 8 }}>
                  <b>Uploaded to S3:</b> <code>{uploadedKey}</code>
                </div>
              ) : null}
    
              {downloadUrl ? (
                <div style={{ marginTop: 8 }}>
                  Local file: <code>{filename}</code>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
