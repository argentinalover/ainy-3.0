import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import AinyFace from "./AinyFace.jsx";
import eyesImage from "../Images/eyes(waves).png";
import leoMascot from "../Images/LEO_official_mascot.png";
import spaceAppsLogo from "../Images/space_apps.png";
import {
  KEYBOARD_ALERTS,
  SIMULATED_ALERT_VALUES,
  calculateStability,
  resetStabilityHistory
} from "../stability/stabilityEngine.js";
import { simulateValues, setSimulationValue } from "../stability/simulation.js";
import { VARIABLES } from "../stability/variables.js";
import { parseSpeechResponse, waitForSpeechPause } from "./speechResponse.js";
import "./styles.css";

const PRIMARY_METRICS = ["radiation", "cortisol", "sleep", "heartRate"];
const SECONDARY_METRICS = ["microgravity", "muscleLoss"];
const OrbitPreview = lazy(() => import("./OrbitPreview.jsx"));
const API_BASE_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
  : "";
const METRIC_STATUS_LABELS = {
  stable: "NOMINAL",
  observation: "OBSERVATION",
  alert: "ALERT"
};

function isConsolePath() {
  return window.location.pathname.replace(/\/+$/, "") === "/page";
}

function formatMetricValue(key, value) {
  if (key === "microgravity") return value.toExponential(2);
  if (key === "heartRate") return Math.round(value).toString();
  if (key === "sleep" || key === "muscleLoss") return value.toFixed(1);
  return value.toFixed(2);
}

function playThinkingCue(isAlert = false) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isAlert ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isAlert ? 660 : 520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isAlert ? 880 : 680, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
  } catch {
    // Ignorar si el navegador bloquea Web Audio antes de interacción
  }
}

function App() {
  const [isConsolePage, setIsConsolePage] = useState(isConsolePath);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [activeAlert, setActiveAlert] = useState(null);
  const [sensorValues, setSensorValues] = useState(() => simulateValues());
  const [stabilityResult, setStabilityResult] = useState(() =>
    calculateStability(simulateValues())
  );
  const [secondaryMetric, setSecondaryMetric] = useState("microgravity");
  const [isOrbitExpanded, setIsOrbitExpanded] = useState(false);
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const isSendingRef = useRef(false);
  const lastAnnouncedAlertRef = useRef(null);

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
    if (!isConsolePage) setIsOrbitExpanded(false);
  }, [isConsolePage]);

  useEffect(() => {
    function updateSimulation() {
      const values = simulateValues();
      setSensorValues(values);
      setStabilityResult(calculateStability(values));
    }

    updateSimulation();
    const intervalId = window.setInterval(updateSimulation, 1200);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isConsolePage) return undefined;

    const intervalId = window.setInterval(() => {
      setSecondaryMetric((currentMetric) =>
        currentMetric === "microgravity" ? "muscleLoss" : "microgravity"
      );
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [isConsolePage]);

  const sendTelemetryPrompt = useCallback(
    async ({
      promptText,
      overrideAlert = activeAlert,
      overrideValues = null,
      overrideStability = null,
      clearInput = false,
      isProactive = false
    }) => {
      if (!promptText || isSendingRef.current) return;

      isSendingRef.current = true;
      setError("");
      setLastResponse("");
      audioRef.current?.pause();
      setIsSpeaking(false);
      setIsSending(true);
      playThinkingCue(isProactive);

      const currentValues = overrideValues || simulateValues();
      const currentStability = overrideStability || calculateStability(currentValues);
      setSensorValues(currentValues);
      setStabilityResult(currentStability);

      try {
        const chatResponse = await fetch(`${API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: promptText,
            activeAlert: overrideAlert,
            telemetry: currentValues,
            stability: currentStability
          }),
        });
        const chatData = await chatResponse.json();
        if (!chatResponse.ok) {
          throw new Error(chatData.error || "Ainy could not process the message.");
        }
        if (typeof chatData.response !== "string" || !chatData.response.trim()) {
          throw new Error("The backend returned an empty response.");
        }

        const { text: responseText, pauseMs } = parseSpeechResponse(
          chatData.response,
        );
        setLastResponse(responseText);
        if (clearInput) setMessage("");

        const ttsResponse = await fetch(`${API_BASE_URL}/api/tts`, {
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
        await waitForSpeechPause(pauseMs);
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
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [activeAlert]
  );

  // Disparador autónomo de prevención cuando una métrica entra en alerta crítica
  useEffect(() => {
    if (!activeAlert) {
      lastAnnouncedAlertRef.current = null;
      return;
    }
    if (lastAnnouncedAlertRef.current === activeAlert) return;

    lastAnnouncedAlertRef.current = activeAlert;
    const variableName = VARIABLES[activeAlert]?.name || activeAlert;

    // Si estaba hablando otra cosa, libera el lock para priorizar la alerta crítica
    if (isSendingRef.current) {
      isSendingRef.current = false;
    }

    sendTelemetryPrompt({
      promptText: `Autonomous preventive alert triggered: ${variableName} has entered a critical threshold. Immediately warn the crew member without waiting to be asked, state the exact reading, and give one preventive action.`,
      overrideAlert: activeAlert,
      overrideValues: sensorValues,
      overrideStability: stabilityResult,
      clearInput: false,
      isProactive: true
    });
  }, [activeAlert, sensorValues, stabilityResult, sendTelemetryPrompt]);

  useEffect(() => {
    function clearActiveAlert() {
      if (activeAlert) {
        setSimulationValue(activeAlert, VARIABLES[activeAlert].value);
        resetStabilityHistory(activeAlert);
        const values = simulateValues();
        setSensorValues(values);
        setStabilityResult(calculateStability(values));
      }
      setActiveAlert(null);
      lastAnnouncedAlertRef.current = null;
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

      const values = simulateValues();
      const result = calculateStability(values);
      setSensorValues(values);
      setStabilityResult(result);
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

    await sendTelemetryPrompt({
      promptText: submittedMessage,
      clearInput: true,
      isProactive: false
    });
  }

  const alertClass = activeAlert
    ? ` app--alert-${activeAlert === "heartRate" ? "heart-rate" : activeAlert}`
    : "";
  const aiStatus = isSending ? "THINKING" : isSpeaking ? "SPEAKING" : "ONLINE";

  return (
    <main className={`app${alertClass}`}>
      <div className="brand-marks" aria-label="Project logos">
        <img
          className="brand-mark brand-mark--space-apps"
          src={spaceAppsLogo}
          alt="International Space Apps Challenge"
        />
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
          aria-label="Simulated biometric data console"
          aria-hidden={!isConsolePage}
        >
          <header className="console-heading">
            <h1>BIOMETRIC MONITOR</h1>
            <span>SIMULATION ACTIVE</span>
          </header>
          <div className="metric-grid">
            {PRIMARY_METRICS.map((metricKey) => {
              const variable = VARIABLES[metricKey];
              const metricResult = stabilityResult?.variables[metricKey];
              const metricStatus = metricResult?.status ?? "stable";
              const metricValue = sensorValues[metricKey] ?? variable.value;

              return (
                <article
                  className={`metric-card metric-card--${metricStatus}`}
                  key={metricKey}
                  style={{ "--metric-color": variable.indicatorColor }}
                >
                  <div className="metric-card__header">
                    <span>{variable.name}</span>
                    <span className="metric-card__status">
                      {METRIC_STATUS_LABELS[metricStatus]}
                    </span>
                  </div>
                  <div className="metric-card__reading">
                    <strong>{formatMetricValue(metricKey, metricValue)}</strong>
                    <span>{variable.unit}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
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
        {isConsolePage && (
          <Suspense
            fallback={
              <div
                className="orbit-preview orbit-preview--loading"
                aria-hidden="true"
              />
            }
          >
            <OrbitPreview
              isExpanded={isOrbitExpanded}
              onToggle={() => setIsOrbitExpanded((expanded) => !expanded)}
            />
          </Suspense>
        )}
        {isConsolePage && (
          <div className="face-footer">
            <section
              className={`face-footer-card ai-status-card ${
                isSpeaking ? "ai-status-card--speaking" : ""
              }`}
              aria-label={`LEO AI ${aiStatus.toLowerCase()}`}
            >
              <span className="ai-status-card__light" />
              <span className="ai-status-card__copy">
                <span>LEO AI</span>
                <strong>{aiStatus}</strong>
              </span>
            </section>
            <section
              className="face-footer-card secondary-metric-card"
              aria-label="Simulated secondary biometric"
            >
              {SECONDARY_METRICS.map((metricKey) => {
                const variable = VARIABLES[metricKey];
                const isActive = secondaryMetric === metricKey;
                const metricValue = sensorValues[metricKey] ?? variable.value;

                return (
                  <div
                    className={`secondary-metric ${
                      isActive ? "secondary-metric--active" : ""
                    }`}
                    key={metricKey}
                    aria-hidden={!isActive}
                  >
                    <span className="secondary-metric__label">
                      {variable.name}
                    </span>
                    <strong>{formatMetricValue(metricKey, metricValue)}</strong>
                    <span className="secondary-metric__unit">{variable.unit}</span>
                  </div>
                );
              })}
            </section>
          </div>
        )}
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
            placeholder={isSending ? "Ainy is thinking..." : ""}
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
        {isSending && !isSpeaking && (
          <p className="tts-subtitle" aria-live="polite" aria-atomic="true">
            <span>Ainy is analyzing telemetry...</span>
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