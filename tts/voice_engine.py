import os
import wave
from io import BytesIO
from pathlib import Path

from piper import PiperVoice
from piper.config import SynthesisConfig

DEFAULT_MODEL_PATH = Path(__file__).parent / "models" / "en_US-mike-medium.onnx"
DEFAULT_LENGTH_SCALE = 1.08


class VoiceEngine:
    def __init__(self):
        model_path = Path(os.environ.get("PIPER_MODEL_PATH", DEFAULT_MODEL_PATH))
        if not model_path.is_file():
            raise FileNotFoundError(
                f"Piper voice model not found at {model_path}. "
                "Download en_US-mike-medium with the setup instructions."
            )

        self.voice = PiperVoice.load(model_path)
        self.synthesis_config = SynthesisConfig(length_scale=DEFAULT_LENGTH_SCALE)

    def generate_audio(self, text: str) -> bytes:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty.")

        audio_buffer = BytesIO()
        with wave.open(audio_buffer, "wb") as wav_file:
            self.voice.synthesize_wav(
                text.strip(),
                wav_file,
                syn_config=self.synthesis_config,
            )
        return audio_buffer.getvalue()
