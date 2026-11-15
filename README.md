# Ainy

Ainy is an astronaut wellness assistant with a React interface, a Gemini-powered chat endpoint, and local Qwen3 text-to-speech.

## Requirements

- Python 3.12
- Node.js 20.19+ or 22.12+
- A Gemini API key for AI responses

The Qwen3-TTS model is downloaded automatically the first time speech is generated. The first generation requires an internet connection and can take longer while the model loads.

## Setup

1. Create and activate a Python virtual environment:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install the backend and TTS dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   python -m pip install -r requirements-tts.txt
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

The chat responds in Spanish. The interface and application instructions are in English.

## Knowledge libraries

- `libraries/ai_characteristics` is reserved for Ainy's identity, traits, and prompt guidance.
- `libraries/mission_context` is reserved for crew and mission context.

These libraries are placeholders and are not loaded by the application yet.

## TTS

The backend TTS endpoint and local Qwen3-TTS engine remain available. Frontend speech controls are temporarily removed until automatic speech generation is implemented.
