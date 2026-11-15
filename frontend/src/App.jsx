import { useEffect, useRef, useState } from "react";
import AinyFace from "./AinyFace.jsx";
import eyesImage from "../Images/eyes(waves).png";
import leoMascot from "../Images/LEO_official_mascot.png";
import nasaLogo from "../Images/NASA-Logo-Large.png";
import {
  KEYBOARD_ALERTS,
  SIMULATED_ALERT_VALUES,
  calculateStability,
  resetStabilityHistory
} from "../stability/stabilityEngine.js";
import { simulateValues, setSimulationValue } from "../stability/simulation.js";
import { VARIABLES } from "../stability/variables.js";
import "./styles.css";

function isConsolePath() {
  return window.location.pathname.replace(/\/+$/, "") === "/page";
}

function App() {
  const [isConsolePage, setIsConsolePage] = useState(isConsolePath);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [activeAlert, setActiveAlert] = useState(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");

  useEffect(() => {
    function handlePopState() {
      setIsConsolePage(isConsolePath());
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function clearActiveAlert() {
      if (activeAlert) {
        setSimulationValue(activeAlert, VARIABLES[activeAlert].value);
        resetStabilityHistory(activeAlert);
      }
      setActiveAlert(null);
    }

    function handleAlertKeyDown(event) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        event.isComposing
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

      if (event.code === "Escape") {
        clearActiveAlert();
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(KEYBOARD_ALERTS, event.code)) {
        return;
      }

      event.preventDefault();
      const metric = KEYBOARD_ALERTS[event.code];
      if (metric === activeAlert) {
        clearActiveAlert();
        return;
      }

      if (activeAlert) {
        setSimulationValue(activeAlert, VARIABLES[activeAlert].value);
        resetStabilityHistory(activeAlert);
      }
      resetStabilityHistory(metric);
      setSimulationValue(metric, SIMULATED_ALERT_VALUES[metric]);

      const result = calculateStability(simulateValues());
      if (result.variables[metric].status !== "stable") {
        setActiveAlert(metric);
      }
    }

    window.addEventListener("keydown", handleAlertKeyDown);
    return () => window.removeEventListener("keydown", handleAlertKeyDown);
  }, [activeAlert]);

  function moveToConsole() {
    if (!isConsolePage) {
      window.history.pushState({}, "", "/page");
      setIsConsolePage(true);
    }
  }

  function returnHome() {
    if (isConsolePage) {
      window.history.pushState({}, "", "/");
      setIsConsolePage(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const submittedMessage = message.trim();
    if (!submittedMessage || isSending) return;

    setError("");
    setLastResponse("");
    audioRef.current?.pause();
    setIsSpeaking(false);
    setIsSending(true);

    try {
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: submittedMessage }),
      });
      const chatData = await chatResponse.json();
      if (!chatResponse.ok) {
        throw new Error(chatData.error || "Ainy could not process the message.");
      }
      if (typeof chatData.response !== "string" || !chatData.response.trim()) {
        throw new Error("The backend returned an empty response.");
      }

      const responseText = chatData.response.trim();
      setLastResponse(responseText);
      setMessage("");

      const ttsResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: responseText }),
      });
      if (!ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        throw new Error(ttsData.error || "Ainy could not generate speech.");
      }

      const audioBlob = await ttsResponse.blob();
      if (!audioBlob.size) {
        throw new Error("The voice service returned empty audio.");
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioUrlRef.current = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrlRef.current;
      try {
        await audioRef.current.play();
      } catch {
        setError("Automatic playback was blocked by the browser.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not connect to Ainy.",
      );
    } finally {
      setIsSending(false);
    }
  }

  const alertClass = activeAlert
    ? ` app--alert-${activeAlert === "heartRate" ? "heart-rate" : activeAlert}`
    : "";

  return (
    <main className={`app${alertClass}`}>
      <div className="brand-marks" aria-label="Project logos">
        <img className="brand-mark brand-mark--nasa" src={nasaLogo} alt="NASA" />
        <img
          className="brand-mark brand-mark--leo"
          src={leoMascot}
          alt="LEO official mascot"
        />
      </div>
      <div
        className={`design-stage ${isConsolePage ? "design-stage--console" : ""}`}
      >
        <section
          className="console-panel"
          aria-label="Biometric data console, design in progress"
          aria-hidden={!isConsolePage}
        />
        <button
          className={`face-panel ${
            isConsolePage ? "face-panel--console" : "face-panel--home"
          }`}
          type="button"
          onClick={isConsolePage ? returnHome : moveToConsole}
          aria-label={isConsolePage ? "Return to home page" : "Open AI console"}
        >
          <div className="face-eyes">
            <img className="face-eye face-eye--left" src={eyesImage} alt="" />
            <AinyFace audioRef={audioRef} isSpeaking={isSpeaking} />
            <img className="face-eye face-eye--right" src={eyesImage} alt="" />
          </div>
        </button>
        <form
          className={`message-bar ${
            isConsolePage ? "message-bar--hidden" : ""
          }`}
          onSubmit={handleSubmit}
          aria-hidden={isConsolePage}
          inert={isConsolePage}
        >
          <input
            type="text"
            aria-label="Message Ainy"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSending || isConsolePage}
          />
          <button
            className="message-bar__send"
            type="submit"
            aria-label="Send message"
            disabled={isSending || isConsolePage || !message.trim()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </form>
        {error && (
          <p className="message-error" role="alert">
            {error}
          </p>
        )}
        {isSpeaking && lastResponse && (
          <p className="tts-subtitle" aria-live="polite" aria-atomic="true">
            <span>{lastResponse}</span>
          </p>
        )}
        <audio
          ref={audioRef}
          hidden
          onPlay={() => setIsSpeaking(true)}
          onPause={() => setIsSpeaking(false)}
          onEnded={() => setIsSpeaking(false)}
        />
      </div>
    </main>
  );
}

export default App;
