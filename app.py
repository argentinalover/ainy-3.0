import os
import random
from io import BytesIO
from threading import Lock

import httpx
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, send_from_directory
from google import genai
from google.genai.errors import APIError
from google.genai.types import GenerateContentConfig

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
app = Flask(
    __name__,
    static_folder=os.path.join(FRONTEND_DIST, "assets"),
    static_url_path="/assets",
)
load_dotenv(os.path.join(app.root_path, ".env"))
MAX_CHAT_INPUT_LENGTH = 2000
MAX_TTS_TEXT_LENGTH = 8000
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
VOICE_ENGINE = None
VOICE_ENGINE_LOCK = Lock()


class TTSUnavailableError(Exception):
    pass


if not GEMINI_API_KEY:
    app.logger.warning("GEMINI_API_KEY is empty. Add it to .env and restart the server.")

crew_biometrics = {
    "heart_rate": 72,
    "spo2": 99,
    "radiation_msv": 0.14,
}


@app.get("/")
def home():
    return send_from_directory(FRONTEND_DIST, "index.html")


@app.get("/api/status")
def api_status():
    return jsonify(
        provider="Gemini" if GEMINI_CLIENT else "basic",
        model=GEMINI_MODEL,
        configured=GEMINI_CLIENT is not None,
    )


@app.get("/api/biometrics")
def get_biometrics():
    crew_biometrics["heart_rate"] = random.randint(68, 76)
    crew_biometrics["radiation_msv"] = round(random.uniform(0.12, 0.18), 3)
    return jsonify(crew_biometrics)


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
                    "TTS is not ready. Install the packages in requirements-tts.txt "
                    "and check the model download."
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
                "The API is running in basic mode. I received your message, but "
                "GEMINI_API_KEY must be configured to enable AI responses."
            )
        )

    system_instruction = (
        "You are an AI powered by Ainy group, a NASA team formed by two brothers from argentina"
        "you only reply with short and concise answers to the user, you are not allowed to"
        "do any harm to anyone, nor provide sensitive information"
    )

    try:
        response = GEMINI_CLIENT.models.generate_content(
            model=GEMINI_MODEL,
            contents=message,
            config=GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.4,
                max_output_tokens=4096,
            ),
        )
    except (APIError, httpx.HTTPError, TimeoutError) as error:
        app.logger.error("Gemini request failed: %s", error)
        return jsonify(error="Gemini could not process the message. Please try again."), 502

    response_text = (response.text or "").strip()
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

    try:
        audio = get_voice_engine().generate_audio(text)
    except TTSUnavailableError as error:
        return jsonify(error=str(error)), 503
    except (OSError, RuntimeError) as error:
        app.logger.exception("TTS audio generation failed")
        return jsonify(error="Qwen3-TTS could not generate the audio."), 502

    return send_file(
        BytesIO(audio),
        mimetype="audio/wav",
        as_attachment=False,
        download_name="ainy-response.wav",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
