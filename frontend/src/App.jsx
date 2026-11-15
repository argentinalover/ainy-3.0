
import "./styles.css";
import { useEffect, useState } from "react";
import AinyFace from "./AinyFace.jsx";
import {
  calculateStability,
  resetStabilityHistory,
} from "../stability/stabilityEngine.js";
import {
  setSimulationValue,
  simulateValues,
} from "../stability/simulation.js";
import { VARIABLES } from "../stability/variables.js";

const INDICATOR_KEYS = [
  "heartRate",
  "microgravity",
  "cortisol",
  "muscleLoss",
  "sleep",
  "radiation",
];
const STABILITY_COLORS = {
  stable: {
    primary: "#e5ad4f",
    secondary: "#f07836",
  },
  observation: {
    primary: "#f1b84b",
    secondary: "#e7853b",
  },
  alert: {
    primary: "#ee6f57",
    secondary: "#ec4f51",
  },
};

function App() {
  const [message, setMessage] = useState("");
  const [assistantMessage, setAssistantMessage] = useState(
    "I'm here. How can I help?",
  );
  const [isSending, setIsSending] = useState(false);
  const [stability, setStability] = useState({
    stabilityScore: 100,
    status: "stable",
  });
  const [activeIndicators, setActiveIndicators] = useState({});
  const [speechUrl, setSpeechUrl] = useState("");
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioElement, setAudioElement] = useState(null);

  useEffect(() => {
    const updateStability = () => {
      setStability(calculateStability(simulateValues()));
    };

    updateStability();
    const intervalId = window.setInterval(updateStability, 2000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      if (speechUrl) URL.revokeObjectURL(speechUrl);
    };
  }, [speechUrl]);

  const gradientColors =
    STABILITY_COLORS[stability.status] || STABILITY_COLORS.stable;
  const gradientStyle = {
    "--stability-color-primary": gradientColors.primary,
    "--stability-color-secondary": gradientColors.secondary,
    "--stability-opacity": (
      0.24 +
      ((100 - stability.stabilityScore) / 100) * 0.32
    ).toFixed(2),
  };

  function toggleIndicator(key) {
    const variable = VARIABLES[key];
    const isActive = Boolean(activeIndicators[key]);

    resetStabilityHistory(key);
    setSimulationValue(
      key,
      isActive ? variable.value : variable.max + (variable.max - variable.min),
    );
    setActiveIndicators((current) => ({ ...current, [key]: !isActive }));
    setStability(calculateStability(simulateValues()));
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        !/^[1-6]$/.test(event.key)
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      ) {
        return;
      }

      const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
      if (hasModifier) return;

      event.preventDefault();
      toggleIndicator(INDICATOR_KEYS[Number(event.key) - 1]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndicators]);

  async function handleGenerateSpeech() {
    if (!assistantMessage.trim() || isGeneratingSpeech) return;

    setIsGeneratingSpeech(true);
    setIsSpeaking(false);
    setSpeechError("");
    setSpeechUrl("");

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: assistantMessage }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not generate the audio.");
      }

      const audioUrl = URL.createObjectURL(await response.blob());
      setSpeechUrl(audioUrl);
    } catch (error) {
      setSpeechError(
        error instanceof Error
          ? error.message
          : "Could not connect to the voice service.",
      );
    } finally {
      setIsGeneratingSpeech(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const submittedMessage = message.trim();
    if (!submittedMessage || isSending) return;

    setIsSending(true);
    setAssistantMessage("Thinking...");
    setIsSpeaking(false);
    setSpeechUrl("");
    setSpeechError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: submittedMessage }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not send the message.");
      }

      setAssistantMessage(data.response);
      setMessage("");
    } catch (error) {
      setAssistantMessage(
        error instanceof Error
          ? error.message
          : "Could not connect to the server.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app" style={gradientStyle}>
      <section className="main-content">
        <AinyFace audioElement={audioElement} isSpeaking={isSpeaking} />

        <p className="assistant-message" aria-live="polite">
          {assistantMessage}
        </p>
        <div className="assistant-audio">
          <button
            type="button"
            className="speech-button"
            onClick={handleGenerateSpeech}
            disabled={isGeneratingSpeech}
          >
            {isGeneratingSpeech ? "Generating speech…" : "Generate speech"}
          </button>
          {speechUrl && (
            <audio
              controls
              ref={setAudioElement}
              src={speechUrl}
              onPlay={() => setIsSpeaking(true)}
              onPause={() => setIsSpeaking(false)}
              onEnded={() => setIsSpeaking(false)}
            />
          )}
          {speechError && (
            <p className="speech-error" role="alert">
              {speechError}
            </p>
          )}
        </div>
      </section>

      <form className="chat-container" onSubmit={handleSubmit}>
        <input
          type="text"
          aria-label="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isSending}
        />

        <button type="submit" aria-label="Send message" disabled={isSending}>
          {isSending ? "…" : "↑"}
        </button>
      </form>
    </main>
  );
}

export default App;
