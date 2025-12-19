import React, { useRef, useState } from "react";

function pickBestMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

export default function Recorder() {
  const [status, setStatus] = useState("idle"); // idle | recording | stopped | error
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [filename, setFilename] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const screenStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const mixedStreamRef = useRef(null);

  async function startRecording() {
    setError("");
    setDownloadUrl("");
    setFilename("");

    try {
      setStatus("prompting");

      // 1) Capture the tab/screen. audio:true is REQUIRED for “Share tab audio” to appear.
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
        },
        audio: true,
      });
      screenStreamRef.current = screenStream;

      // IMPORTANT: if user did NOT check "Share tab audio", there may be no audio track.
      const tabAudioTracks = screenStream.getAudioTracks();
      const hasTabAudio = tabAudioTracks.length > 0;

      // 2) Capture mic (optional but recommended). If user denies, we still proceed with tab audio.
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
      } catch (e) {
        // User denied mic or no mic. That's okay.
        micStream = null;
      }
      micStreamRef.current = micStream;

      // 3) Mix audio tracks (tab audio + mic) into ONE track.
      // MediaRecorder can record multiple tracks, but mixing gives the most consistent results.
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

      // Build final stream: screen video + mixed audio (if any)
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
        if (evt.data && evt.data.size > 0) {
          chunksRef.current.push(evt.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);

        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `meeting-recording-${ts}.webm`;
        setFilename(name);

        setStatus("stopped");
      };

      recorder.start(1000); // collect data every second
      setStatus("recording");

      // UX guardrail: if we don’t have tab audio, tell them immediately.
      if (!hasTabAudio) {
        setError(
          "Recording started, but no TAB audio was detected. In the share picker, you must choose the Google Meet TAB and enable 'Share tab audio'. Stop and try again."
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
    // Stop screen capture
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    // Stop mic capture
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    // Mixed stream is derived; no need to stop separately beyond its tracks
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
  const canStart = !isRecording;
  const canStop = status === "recording";

  return (
    <div style={{ maxWidth: 720, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Meeting Recorder</h2>

      <ol style={{ marginTop: 0 }}>
        <li>Click <b>Start Recording</b></li>
        <li>In the picker, choose <b>Chrome Tab</b></li>
        <li>Select the <b>Google Meet tab</b></li>
        <li>Enable <b>Share tab audio</b></li>
        <li>Click <b>Share</b></li>
      </ol>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={startRecording} disabled={!canStart} style={{ padding: "8px 12px" }}>
          Start Recording
        </button>
        <button onClick={stopRecording} disabled={!canStop} style={{ padding: "8px 12px" }}>
          Stop
        </button>
        <button onClick={download} disabled={!downloadUrl} style={{ padding: "8px 12px" }}>
          Download
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div><b>Status:</b> {status}</div>
        {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}
        {downloadUrl ? (
          <div style={{ marginTop: 8 }}>
            Ready to download: <code>{filename}</code>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>
        Note: If you do not select the Meet <b>tab</b> or you do not enable <b>Share tab audio</b>,
        you will likely only capture your mic (or no audio).
      </div>
    </div>
  );
}
