
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
  const [speechUrl, setSpeechUrl] = useState("");
  const [audioElement, setAudioElement] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [stability, setStability] = useState({
    stabilityScore: 100,
    status: "stable",
  });
  const [activeIndicators, setActiveIndicators] = useState({});

  useEffect(() => {
    if (!speechUrl) return undefined;
    return () => URL.revokeObjectURL(speechUrl);
  }, [speechUrl]);

  useEffect(() => {
    if (!speechUrl || !audioElement) return undefined;

    let active = true;
    audioElement.play().catch((error) => {
      if (!active) return;

      setIsSpeaking(false);
      setSpeechError(
        error.name === "NotAllowedError"
          ? "Allow audio playback in your browser to hear Ainy's voice."
          : "Ainy generated speech, but the audio could not be played.",
      );
    });

    return () => {
      active = false;
    };
  }, [audioElement, speechUrl]);

  useEffect(() => {
    const updateStability = () => {
      setStability(calculateStability(simulateValues()));
    };

    updateStability();
    const intervalId = window.setInterval(updateStability, 2000);

    return () => window.clearInterval(intervalId);
  }, []);

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

  async function handleSubmit(event) {
    event.preventDefault();
    const submittedMessage = message.trim();
    if (!submittedMessage || isSending) return;

    audioElement?.pause();
    setSpeechUrl("");
    setIsSpeaking(false);
    setSpeechError("");
    setIsSending(true);
    setAssistantMessage("Thinking...");

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

      try {
        const speechResponse = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: data.response }),
        });

        if (!speechResponse.ok) {
          const speechData = await speechResponse.json();
          throw new Error(speechData.error || "Could not generate the audio.");
        }

        const audioBlob = await speechResponse.blob();
        if (!audioBlob.size) {
          throw new Error("The voice service returned empty audio.");
        }

        setSpeechUrl(URL.createObjectURL(audioBlob));
      } catch (error) {
        setSpeechError(
          error instanceof Error
            ? error.message
            : "Could not connect to the voice service.",
        );
      }
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
        {speechError && (
          <p className="speech-error" role="alert">
            {speechError}
          </p>
        )}
        <audio
          ref={setAudioElement}
          src={speechUrl || undefined}
          preload="auto"
          hidden
          aria-hidden="true"
          onPlay={() => {
            setIsSpeaking(true);
            setSpeechError("");
          }}
          onPause={() => setIsSpeaking(false)}
          onEnded={() => setIsSpeaking(false)}
          onError={() => {
            if (speechUrl) {
              setSpeechError("Ainy generated speech, but the audio could not be played.");
            }
          }}
        />
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
