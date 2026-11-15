import { useEffect, useRef } from "react";

export default function AinyFace({ audioElement, isSpeaking }) {
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    if (!audioElement || !window.AudioContext) return;

    const audioContext = new window.AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;

    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyserRef.current = analyser;

    function resumeAudioContext() {
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
    }

    audioElement.addEventListener("play", resumeAudioContext);

    return () => {
      audioElement.removeEventListener("play", resumeAudioContext);
      analyserRef.current = null;
      audioContext.close();
    };
  }, [audioElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId;
    const samples = new Uint8Array(512);

    function drawWaveform() {
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

      const centerY = height / 2;
      const analyser = analyserRef.current;
      if (isSpeaking && analyser) {
        analyser.getByteTimeDomainData(samples);
      } else {
        samples.fill(128);
      }

      context.beginPath();
      context.strokeStyle = isSpeaking ? "#00F0FF" : "#536171";
      context.lineWidth = 2;
      const barCount = Math.max(1, Math.floor(width / 7));
      const groupSize = Math.floor(samples.length / barCount);

      for (let bar = 0; bar < barCount; bar += 1) {
        const start = bar * groupSize;
        const end = Math.min(start + groupSize, samples.length);
        let peak = 0;

        for (let index = start; index < end; index += 1) {
          peak = Math.max(peak, Math.abs(samples[index] - 128) / 128);
        }

        const amplitude = isSpeaking
          ? Math.max(2, peak * height * 0.42)
          : 2;
        const x = (bar + 0.5) * (width / barCount);
        context.moveTo(x, centerY - amplitude);
        context.lineTo(x, centerY + amplitude);
      }

      context.stroke();
      if (isSpeaking) frameId = requestAnimationFrame(drawWaveform);
    }

    drawWaveform();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isSpeaking, audioElement]);

  return (
    <div
      className="ainy-face"
      role="img"
      aria-label={
        isSpeaking
          ? "Ainy voice visualizer active"
          : "Ainy voice visualizer idle"
      }
    >
      <canvas
        ref={canvasRef}
        className="ainy-face__waveform"
        aria-hidden="true"
      />
    </div>
  );
}