import "./styles.css";
import { useEffect, useRef, useState } from "react";
import AinyFace from "./AinyFace.jsx";
import { calculateStability } from "../stability/stabilityEngine.js";
import {
  setSimulationValue,
  simulateValues,
} from "../stability/simulation.js";

const STABILITY_COLORS = {
  stable: ["#e5ad4f", "#f07836"],
  observation: ["#f1b84b", "#e7853b"],
  alert: ["#ee6f57", "#ec4f51"],
};

function createMessage(role, content) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    role,
    content,
  };
}

async function readJsonResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    createMessage("assistant", "I'm here. How can I help?"),
  ]);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [biometrics, setBiometrics] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [biometricsError, setBiometricsError] = useState("");
  const [chatError, setChatError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [speechMessageId, setSpeechMessageId] = useState(null);
  const [speechUrl, setSpeechUrl] = useState("");
  const [speechLoadingId, setSpeechLoadingId] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [stability, setStability] = useState({
    stabilityScore: 100,
    status: "stable",
  });
  const speechRequestRef = useRef(null);
  const autoplaySpeechRef = useRef(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!speechUrl) return undefined;
    return () => URL.revokeObjectURL(speechUrl);
  }, [speechUrl]);

  useEffect(() => {
    if (!speechUrl || !audioElement || !autoplaySpeechRef.current) {
      return undefined;
    }

    autoplaySpeechRef.current = false;
    let active = true;
    audioElement.play().catch((error) => {
      if (active && error.name !== "AbortError") {
        setSpeechError(
          "Automatic playback was blocked. Use the audio controls to play this response.",
        );
      }
    });

    return () => {
      active = false;
    };
  }, [audioElement, speechUrl]);

  useEffect(() => {
    return () => speechRequestRef.current?.abort();
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function refreshStatus() {
      try {
        const response = await fetch("/api/status", {
          signal: controller.signal,
        });
        const data = await readJsonResponse(response);
        if (active) {
          setStatus(data);
          setStatusError("");
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setStatusError(
            error instanceof Error ? error.message : "Backend is unavailable.",
          );
        }
      }
    }

    async function refreshBiometrics() {
      try {
        const response = await fetch("/api/biometrics", {
          signal: controller.signal,
        });
        const data = await readJsonResponse(response);
        if (active) {
          setBiometrics(data);
          setSimulationValue("heartRate", data.heart_rate);
          setSimulationValue("radiation", data.radiation_msv);
          setStability(calculateStability(simulateValues()));
          setBiometricsError("");
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setBiometricsError(
            error instanceof Error ? error.message : "Backend is unavailable.",
          );
        }
      }
    }

    refreshStatus();
    refreshBiometrics();
    const statusInterval = window.setInterval(refreshStatus, 30000);
    const biometricsInterval = window.setInterval(refreshBiometrics, 15000);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(statusInterval);
      window.clearInterval(biometricsInterval);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStability(calculateStability(simulateValues()));
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [primaryColor, secondaryColor] =
    STABILITY_COLORS[stability.status] || STABILITY_COLORS.stable;
  const gradientStyle = {
    "--stability-color-primary": primaryColor,
    "--stability-color-secondary": secondaryColor,
    "--stability-opacity": (
      0.6 +
      ((100 - stability.stabilityScore) / 100) * 0.2
    ).toFixed(2),
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const submittedMessage = message.trim();
    if (!submittedMessage || isSending) return;

    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    autoplaySpeechRef.current = false;
    setSpeechLoadingId(null);
    audioElement?.pause();
    setSpeechUrl("");
    setSpeechMessageId(null);
    setIsSpeaking(false);
    setSpeechError("");
    setChatError("");
    setMessages((current) => [
      ...current,
      createMessage("user", submittedMessage),
    ]);
    setMessage("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: submittedMessage }),
      });
      const data = await readJsonResponse(response);
      if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error("The backend returned an empty response.");
      }
      const assistantMessage = createMessage("assistant", data.response.trim());
      setMessages((current) => [...current, assistantMessage]);
      if (status?.tts_enabled) {
        void handleSpeak(assistantMessage, true);
      }
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Could not connect to Ainy.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleSpeak(messageItem, autoplay = false) {
    speechRequestRef.current?.abort();
    const controller = new AbortController();
    speechRequestRef.current = controller;
    autoplaySpeechRef.current = autoplay;
    setSpeechLoadingId(messageItem.id);
    setSpeechError("");
    setSpeechUrl("");
    setSpeechMessageId(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageItem.content }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Voice request failed (${response.status}).`);
      }

      const audioBlob = await response.blob();
      if (controller.signal.aborted) return;
      if (!audioBlob.size) {
        throw new Error("The voice service returned empty audio.");
      }
      setSpeechMessageId(messageItem.id);
      setSpeechUrl(URL.createObjectURL(audioBlob));
    } catch (error) {
      if (error.name !== "AbortError") {
        setSpeechError(
          error instanceof Error
            ? error.message
            : "Could not connect to the voice service.",
        );
      }
    } finally {
      if (speechRequestRef.current === controller) {
        speechRequestRef.current = null;
        setSpeechLoadingId(null);
      }
    }
  }

  return (
    <main
      className="app"
      style={gradientStyle}
      data-stability={stability.status}
    >
      <header className="app-header">
        <div className="brand">
          <span className="brand__name">AINY</span>
          <span className="brand__caption">MISSION WELLNESS</span>
        </div>
        <div className="connection-status" aria-live="polite">
          <span
            className={`status-dot ${status ? "status-dot--online" : ""}`}
          />
          <span>
            {!status
              ? "Connecting to backend"
              : status.configured
                ? "Gemini connected"
                : "Basic mode"}
          </span>
          <span className="status-divider" />
          <span>
            {status?.tts_enabled
              ? status.tts_loaded
                ? "Piper voice ready"
                : "Piper voice available"
              : "Voice disabled"}
          </span>
        </div>
      </header>

      <section className="telemetry" aria-label="Crew biometrics">
        <div className="telemetry__item">
          <span className="telemetry__label">HEART RATE</span>
          <span className="telemetry__value">
            {biometrics ? `${biometrics.heart_rate} bpm` : "--"}
          </span>
        </div>
        <div className="telemetry__item">
          <span className="telemetry__label">SPO2</span>
          <span className="telemetry__value">
            {biometrics ? `${biometrics.spo2}%` : "--"}
          </span>
        </div>
        <div className="telemetry__item">
          <span className="telemetry__label">RADIATION</span>
          <span className="telemetry__value">
            {biometrics ? `${biometrics.radiation_msv} mSv` : "--"}
          </span>
        </div>
        <div className="telemetry__item telemetry__item--stability">
          <span className="telemetry__label">STABILITY</span>
          <span className="telemetry__value">
            {stability.stabilityScore}% · {stability.status}
          </span>
        </div>
      </section>

      <section className="conversation" aria-label="Conversation">
        {messages.map((item) => (
          <article
            className={`message message--${item.role}`}
            key={item.id}
          >
            <span className="message__speaker">
              {item.role === "assistant" ? "AINY" : "YOU"}
            </span>
            <p className="message__content">{item.content}</p>
            {item.role === "assistant" && status?.tts_enabled && (
              <div className="message__voice">
                {speechMessageId === item.id && speechUrl ? (
                  <audio
                    ref={setAudioElement}
                    controls
                    preload="auto"
                    src={speechUrl}
                    onPlay={() => setIsSpeaking(true)}
                    onPause={() => setIsSpeaking(false)}
                    onEnded={() => setIsSpeaking(false)}
                    aria-label="Play Ainy response"
                  />
                ) : (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => handleSpeak(item)}
                    disabled={speechLoadingId !== null}
                  >
                    {speechLoadingId === item.id
                      ? "Generating voice…"
                      : "Listen"}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
        {isSending && (
          <p className="thinking" role="status">
            Ainy is thinking…
          </p>
        )}
        <div ref={messagesEndRef} />
      </section>

      {(statusError || biometricsError || chatError || speechError) && (
        <p className="error-message" role="alert">
          {chatError || speechError || statusError || biometricsError}
        </p>
      )}

      <AinyFace audioElement={audioElement} isSpeaking={isSpeaking} />

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          aria-label="Message"
          placeholder="Message Ainy in English"
          value={message}
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isSending}
        />
        <button
          className="send-button"
          type="submit"
          aria-label="Send message"
          disabled={isSending || !message.trim()}
        >
          {isSending ? "…" : "↑"}
        </button>
      </form>
    </main>
  );
}

export default App;
