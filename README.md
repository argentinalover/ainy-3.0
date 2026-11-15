# Ainy

Ainy is an astronaut wellness assistant with a React interface, a Gemini-powered chat endpoint, and optional local Piper text-to-speech.

## Requirements

- Python 3.12
- Node.js 20.19+ or 22.12+
- A Gemini API key for AI responses

Local Piper TTS is optional and disabled by default, so it does not use memory when it is not needed. The chat and speech output are in English.

## Setup

1. Create and activate a Python virtual environment:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install the backend dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. Create `.env` from `.env.example` and set `GEMINI_API_KEY`.

4. Install the frontend dependencies:

   ```powershell
   cd frontend
   npm install
   ```

## Run

Start the backend from the project root:

```powershell
python app.py
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` requests to the Flask server on port 5000.

The chat responds in English. The interface and application instructions are in English.
Gemini requests time out after 30 seconds, and generated responses are capped at 512 tokens.

## Knowledge libraries

- `libraries/ai_characteristics` is reserved for Ainy's identity, traits, and prompt guidance.
- `libraries/mission_context` is reserved for crew and mission context.

These libraries are placeholders and are not loaded by the application yet.

## Optional local TTS

The lite backend uses Piper with the `en_US-kristin-medium` English voice. On the tested i7-8550U CPU, the model loaded in about 1 second; after the first synthesis, a 6-second sample took about 0.36 seconds to generate. The first synthesis took about 2.1 seconds.

To enable local speech, install the optional dependency and download the voice model:

```powershell
python -m pip install -r requirements-tts.txt
python -m piper.download_voices en_US-kristin-medium --download-dir tts\models
```

Set `ENABLE_LOCAL_TTS=true` in `.env` and restart the backend. The model path defaults to `tts/models/en_US-kristin-medium.onnx`; set `PIPER_MODEL_PATH` to override it. The model is stored locally and is not included in Git. TTS requests are processed one at a time to limit resource usage. The `/api/status` endpoint reports whether TTS is enabled and whether its model has loaded.

The Piper engine is GPL-3.0-or-later. The `en_US-kristin-medium` voice is listed as public domain by its model card and Piper's voice licensing guide. Review the licenses before redistributing the engine or voice.
