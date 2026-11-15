import { useEffect, useRef } from "react";

const AUDIO_GRAPH_KEY = Symbol.for("ainy.voiceReactiveGraph");

function getAudioGraph(audioElement) {
  if (audioElement[AUDIO_GRAPH_KEY]) return audioElement[AUDIO_GRAPH_KEY];

  const audioContext = new window.AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;

  const source = audioContext.createMediaElementSource(audioElement);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  const graph = { audioContext, analyser, source };
  audioElement[AUDIO_GRAPH_KEY] = graph;
  return graph;
}

export default function AinyFace({ audioRef, isSpeaking }) {
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !window.AudioContext) return undefined;

    const graph = getAudioGraph(audioElement);
    analyserRef.current = graph.analyser;

    function resumeAudioContext() {
      if (graph.audioContext.state === "suspended") {
        graph.audioContext.resume().catch((resumeError) => {
          console.error("Could not resume the voice visualizer.", resumeError);
        });
      }
    }

    audioElement.addEventListener("play", resumeAudioContext);

    return () => {
      audioElement.removeEventListener("play", resumeAudioContext);
    };
  }, [audioRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    let frameId;
    const samples = new Uint8Array(512);

    function drawLine() {
      const { width, height } = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;

      if (
        canvas.width !== Math.round(width * pixelRatio) ||
        canvas.height !== Math.round(height * pixelRatio)
      ) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      if (isSpeaking && analyser) {
        analyser.getByteTimeDomainData(samples);
      } else {
        samples.fill(128);
      }

      const centerY = height / 2;
      const maxAmplitude = isSpeaking ? height * 0.52 : 0;
      const lastSample = samples.length - 1;
      context.beginPath();
      context.strokeStyle = isSpeaking
        ? "rgba(255, 223, 177, 0.9)"
        : "rgba(255, 255, 255, 0.42)";
      context.lineWidth = isSpeaking ? 1.5 : 1;
      context.lineCap = "round";

      for (let index = 0; index < samples.length; index += 1) {
        const x = (index / lastSample) * width;
        const envelope = Math.sin((Math.PI * index) / lastSample);
        const amplitude = ((samples[index] - 128) / 128) * maxAmplitude;
        const y = centerY - amplitude * envelope;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.stroke();
      if (isSpeaking) frameId = requestAnimationFrame(drawLine);
    }

    drawLine();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isSpeaking]);

  return (
    <div className="ainy-face" aria-hidden="true">
      <canvas ref={canvasRef} className="ainy-face__waveform" />
    </div>
  );
}