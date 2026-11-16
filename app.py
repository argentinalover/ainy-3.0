import os
import random
from io import BytesIO
from threading import Lock

import httpx
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, send_from_directory
from google import genai
from google.genai.errors import APIError
from google.genai.types import GenerateContentConfig, HttpOptions

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
app = Flask(
    __name__,
    static_folder=os.path.join(FRONTEND_DIST, "assets"),
    static_url_path="/assets",
)
load_dotenv(os.path.join(app.root_path, ".env"))
MAX_CHAT_INPUT_LENGTH = 2000
MAX_CHAT_OUTPUT_TOKENS = 800
MAX_TTS_TEXT_LENGTH = 8000
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_SYSTEM_INSTRUCTION = os.environ.get("GEMINI_SYSTEM_INSTRUCTION", "").strip()
CORS_ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
}
GEMINI_CLIENT = (
    genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=HttpOptions(timeout=30_000),
    )
    if GEMINI_API_KEY
    else None
)
ENABLE_LOCAL_TTS = os.environ.get("ENABLE_LOCAL_TTS", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
VOICE_ENGINE = None
VOICE_ENGINE_LOCK = Lock()
TTS_GENERATION_LOCK = Lock()

# Rangos exactos sincronizados con frontend/src/stability/variables.js
VARIABLE_THRESHOLDS = {
    "radiation": {"name": "Radiation", "unit": "mSv/day", "min": 0.0, "max": 1.0, "default": 0.3},
    "cortisol": {"name": "Cortisol", "unit": "ug/dL", "min": 5.0, "max": 25.0, "default": 12.0},
    "sleep": {"name": "Sleep", "unit": "hours", "min": 7.0, "max": 9.0, "default": 7.5},
    "heartRate": {"name": "Heart Rate", "unit": "bpm", "min": 60.0, "max": 100.0, "default": 72.0},
    "microgravity": {"name": "Microgravity", "unit": "g", "min": 0.0, "max": 0.0001, "default": 0.000001},
    "muscleLoss": {"name": "Muscle Loss", "unit": "%", "min": 0.0, "max": 5.0, "default": 0.0},
}


class TTSUnavailableError(Exception):
    pass


if not GEMINI_API_KEY:
    app.logger.warning("GEMINI_API_KEY is empty. Add it to .env and restart the server.")


def evaluate_frontend_telemetry(payload):
    """Evalúa las variables recibidas del frontend sin diluir picos críticos en un promedio."""
    raw_telemetry = payload.get("telemetry") if isinstance(payload.get("telemetry"), dict) else {}
    stability_obj = payload.get("stability") if isinstance(payload.get("stability"), dict) else {}
    stability_vars = stability_obj.get("variables") if isinstance(stability_obj.get("variables"), dict) else {}
    active_alert = payload.get("activeAlert")

    readings = {}
    alerts = []

    for key, spec in VARIABLE_THRESHOLDS.items():
        val = raw_telemetry.get(key, spec["default"])
        if not isinstance(val, (int, float)) or isinstance(val, bool):
            val = spec["default"]

        formatted_val = round(val, 6) if key == "microgravity" else round(val, 2)
        readings[key] = f"{formatted_val} {spec['unit']}"

        var_status = stability_vars.get(key, {}).get("status")
        if val > spec["max"] or val < spec["min"] or var_status == "alert" or active_alert == key:
            alerts.append(
                f"{spec['name']} CRITICAL at {formatted_val} {spec['unit']} "
                f"(nominal range {spec['min']} to {spec['max']} {spec['unit']})"
            )

    return readings, alerts, stability_obj.get("stabilityScore")


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "").rstrip("/")
    if origin in CORS_ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Max-Age"] = "600"
        response.vary.add("Origin")
    return response


@app.get("/")
@app.get("/page")
def home():
    return send_from_directory(FRONTEND_DIST, "index.html")


@app.get("/api/status")
def api_status():
    return jsonify(
        provider="Gemini" if GEMINI_CLIENT else "basic",
        model=GEMINI_MODEL,
        configured=GEMINI_CLIENT is not None,
        tts_enabled=ENABLE_LOCAL_TTS,
        tts_loaded=VOICE_ENGINE is not None,
    )


@app.get("/api/biometrics")
def get_biometrics():
    return jsonify(
        heart_rate=random.randint(68, 76),
        spo2=99,
        radiation_msv=round(random.uniform(0.12, 0.18), 3),
    )


def get_voice_engine():
    global VOICE_ENGINE

    with VOICE_ENGINE_LOCK:
        if VOICE_ENGINE is None:
            try:
                from tts.voice_engine import VoiceEngine

                VOICE_ENGINE = VoiceEngine()
            except (ImportError, OSError, RuntimeError) as error:
                app.logger.exception("TTS model initialization failed")
                raise TTSUnavailableError(
                    "Piper TTS is not ready. Install the packages in "
                    "requirements-tts.txt and check the voice model download."
                ) from error

    return VOICE_ENGINE


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("message"), str):
        return jsonify(error="Send a valid message in JSON format."), 400

    message = payload["message"].strip()
    if not message:
        return jsonify(error="Enter a message before sending it."), 400
    if len(message) > MAX_CHAT_INPUT_LENGTH:
        return jsonify(
            error=f"The message cannot exceed {MAX_CHAT_INPUT_LENGTH} characters."
        ), 413

    if GEMINI_CLIENT is None:
        return jsonify(
            response=(
                "The backend is running in basic mode. I received your message, but "
                "GEMINI_API_KEY must be configured to enable AI responses."
            )
        )

    readings, critical_alerts, stability_score = evaluate_frontend_telemetry(payload)

    if critical_alerts:
        alert_directive = (
            f"CRITICAL OVERRIDE ALERT: {', '.join(critical_alerts)}. "
            f"IGNORE any overall nominal score. DO NOT say the crew member or systems are nominal or stable. "
            f"Immediately warn the user about the critical variable with its exact value and give one brief action."
        )
    else:
        score_text = f"Overall stability score: {stability_score}%. " if stability_score is not None else ""
        alert_directive = (
            f"All monitored simulated variables are within nominal ranges. {score_text}"
            f"Report exact sensor values clearly if asked."
        )

    telemetry_system_instruction = (
        f"{GEMINI_SYSTEM_INSTRUCTION}\n\n"
        f"VOICE TTS DIRECTIVE: You are speaking aloud via Text-to-Speech. Keep your answer ultra-concise "
        f"(1 to 2 short sentences maximum) for fast speech synthesis. NEVER use emojis, asterisks, markdown, "
        f"bullet points, or special symbols. Plain spoken text only. "
        f"Treat these simulated mission sensors as live telemetry and NEVER claim you lack sensor access. "
        f"{alert_directive} "
        f"Exact screen telemetry: {readings}"
    ).strip()

    try:
        response = GEMINI_CLIENT.models.generate_content(
            model=GEMINI_MODEL,
            contents=message,
            config=GenerateContentConfig(
                system_instruction=telemetry_system_instruction,
                temperature=0.25,
                max_output_tokens=MAX_CHAT_OUTPUT_TOKENS,
            ),
        )
    except (APIError, httpx.HTTPError, TimeoutError) as error:
        app.logger.error("Gemini request failed: %s", error)
        return jsonify(error="Gemini could not process the message. Please try again."), 502

    response_text = (response.text or "").replace("*", "").replace("#", "").strip()
    if not response_text:
        return jsonify(error="Gemini did not return a text response."), 502

    return jsonify(response=response_text)


@app.post("/api/tts")
def text_to_speech():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("text"), str):
        return jsonify(error="Send valid text in JSON format."), 400

    text = payload["text"].strip()
    if not text:
        return jsonify(error="There is no text to convert to speech."), 400
    if len(text) > MAX_TTS_TEXT_LENGTH:
        return jsonify(
            error=f"Text for speech cannot exceed {MAX_TTS_TEXT_LENGTH} characters."
        ), 413
    if not ENABLE_LOCAL_TTS:
        return jsonify(
            error="Local TTS is disabled. Set ENABLE_LOCAL_TTS=true to enable it."
        ), 503

    try:
        voice_engine = get_voice_engine()
        with TTS_GENERATION_LOCK:
            audio = voice_engine.generate_audio(text)
    except TTSUnavailableError as error:
        return jsonify(error=str(error)), 503
    except (OSError, RuntimeError) as error:
        app.logger.exception("TTS audio generation failed")
        return jsonify(error="Piper could not generate the audio."), 502

    return send_file(
        BytesIO(audio),
        mimetype="audio/wav",
        as_attachment=False,
        download_name="ainy-response.wav",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)