# Ainy

Ainy is an astronaut wellness assistant with a React frontend canvas, a Gemini-powered chat endpoint, and optional local Piper text-to-speech.

## Requirements

- Python 3.12
- Node.js 20.19+ or 22.12+
- A Gemini API key for AI responses

Local Piper TTS is optional and disabled by default, so it does not use memory when it is not needed. `GEMINI_SYSTEM_INSTRUCTION` is blank by default; set it in `.env` to configure the chat prompt later.

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

The frontend currently renders only the black background and animated gradient wallpaper as a blank canvas for Figma. The Gemini chat and Piper TTS backend endpoints remain available for the next interface iteration.
Gemini requests time out after 30 seconds, and generated responses are capped at 512 tokens.

## Knowledge libraries

- `libraries/ai_characteristics` is reserved for Ainy's identity, traits, and prompt guidance.
- `libraries/mission_context` is reserved for crew and mission context.

These libraries are placeholders and are not loaded by the application yet.

## Optional local TTS

The lite backend uses Piper with the `en_US-mike-medium` U.S. English male voice. Earlier timing measurements on an i7-8550U were made with a different Piper voice, so they may not match Mike.

To enable local speech, install the optional dependency and download the voice model:

```powershell
python -m pip install -r requirements-tts.txt
python -m piper.download_voices en_US-mike-medium --download-dir tts\models
```

Set `ENABLE_LOCAL_TTS=true` in `.env` and restart the backend. The model path defaults to `tts/models/en_US-mike-medium.onnx`; set `PIPER_MODEL_PATH` to override it. The model is stored locally and is not included in Git. TTS requests are processed one at a time to limit resource usage. The `/api/status` endpoint reports whether TTS is enabled and whether its model has loaded. The current blank frontend does not show chat or audio controls.

The Piper engine is GPL-3.0-or-later. The `en_US-mike-medium` voice is listed as CC0. Review the licenses before redistributing the engine or voice.
