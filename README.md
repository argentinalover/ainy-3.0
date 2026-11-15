# Ainy 3.0

Ainy is an astronaut wellness assistant with a React frontend canvas, a Gemini-powered chat endpoint, and optional local Piper text-to-speech.

## Requirements

- Python 3.12
- Node.js 20.19+ or 22.12+
- A Gemini API key for AI responses

Local Piper TTS is optional and disabled by default, so it does not use memory when it is not needed. `.env.example` includes Ainy's Spanish wellness prompt for `GEMINI_SYSTEM_INSTRUCTION`. Replies are limited to 400 tokens, and a leading `[PAUSA: Xs]` marker delays speech playback without being spoken or shown in the subtitle.

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

The frontend follows the current Figma canvas over the animated gradient wallpaper. The home page uses the supplied eyes on a dark rounded panel, with a TTS-reactive line connecting them, centered subtitles shown only during speech, and a working chat bar. Space Apps and LEO marks sit unobtrusively in the upper corners. Clicking the face transitions to `/page`, where it moves to the right of a more opaque console panel. The console displays simulated radiation, cortisol, sleep, and heart-rate readings; a small card below LEO alternates between microgravity and muscle-loss readings. The lower portion of LEO's console panel contains an expandable orbital preview, using the local Earth model with a moving craft, orbit track, and starfield.

The gradient can preview simulated biometric alerts without adding controls to the interface: press `1` for radiation, `2` for cortisol, `3` for sleep, or `4` for heart rate. Press the same key again or `Escape` to clear the alert. These are demo values, not live sensor readings or medical guidance.
Gemini requests time out after 30 seconds, and generated responses are capped at 400 tokens.

## Share the local app with Cloudflare Tunnel

The Flask server serves both the built React frontend and the API on port `5000`. Cloudflare Quick Tunnel provides a temporary public URL; the computer and both processes must stay running.

1. Build the frontend:

   ```powershell
   cd frontend
   npm run build
   ```

2. From the repository root, start the backend with `python app.py`. Open <http://localhost:5000> to verify the app locally.
3. Install Cloudflare Tunnel once on Windows:

   ```powershell
   winget install --id Cloudflare.cloudflared
   ```

4. In another terminal, start a temporary tunnel:

   ```powershell
   cloudflared tunnel --url http://127.0.0.1:5000
   ```

5. Share the `https://…trycloudflare.com` URL printed by the command. The URL changes when the tunnel restarts.

The tunnel makes the app and its Gemini endpoint public without authentication. Anyone with the URL could use the chat and consume your Gemini quota. Set usage limits, and stop the tunnel when you are done showing the app.

## Move the frontend to Vercel later

In Vercel, import the repository, set the project root to `frontend`, choose Vite, and set `VITE_API_BASE_URL` to a public backend URL. The backend can remain on this computer behind a Cloudflare Tunnel, or move to Cloud Run using the root `Dockerfile`. Set `CORS_ALLOWED_ORIGINS` on the backend to the exact Vercel site origin, such as `https://ainy-demo.vercel.app`; the `vercel.json` rewrite keeps `/page` working on refresh.

If the backend remains on this computer, the computer and tunnel must stay running. Use a named Cloudflare Tunnel for a stable URL; a Quick Tunnel URL changes on restart, so Vercel's `VITE_API_BASE_URL` and the backend's allowed origin would need to be updated and redeployed.

The Docker image enables Piper and downloads the existing English `en_US-mike-medium` voice; it may pronounce Spanish with an accent. The local `.env` and downloaded voice models are excluded from the Docker build context. Never put `GEMINI_API_KEY` in a `VITE_` variable or commit it to the repository.

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

Set `ENABLE_LOCAL_TTS=true` in `.env` and restart the backend. The model path defaults to `tts/models/en_US-mike-medium.onnx`; set `PIPER_MODEL_PATH` to override it. The model is stored locally and is not included in Git. TTS requests are processed one at a time to limit resource usage. The `/api/status` endpoint reports whether TTS is enabled and whether its model has loaded.

The Piper engine is GPL-3.0-or-later. The `en_US-mike-medium` voice is listed as CC0. Review the licenses before redistributing the engine or voice.
