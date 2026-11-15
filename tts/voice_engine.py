
from io import BytesIO
from pathlib import Path

import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel


# Model configuration
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"

# Available speakers
DEFAULT_SPEAKER = "Aiden"
LANGUAGE = "Spanish"

# Output directory
OUTPUT_DIR = Path(__file__).parent / "audio"
OUTPUT_DIR.mkdir(exist_ok=True)


class VoiceEngine:

    def __init__(self):
        print("Cargando modelo Qwen3-TTS...")

        self.model = Qwen3TTSModel.from_pretrained(
            MODEL_ID,
            device_map="cpu",
            dtype=torch.float32,
            attn_implementation="eager"
        )

        print("Modelo cargado correctamente.")

    def _synthesize(self, text, speaker):
        if not text or not text.strip():
            raise ValueError("Text cannot be empty.")

        print(f"Generating speech with {speaker}...")

        wavs, sample_rate = self.model.generate_custom_voice(
            text=text.strip(),
            language=LANGUAGE,
            speaker=speaker
        )

        if not wavs:
            raise RuntimeError("Qwen3-TTS returned no audio.")

        return wavs[0], sample_rate

    def generate(self, text, speaker=DEFAULT_SPEAKER):
        waveform, sample_rate = self._synthesize(text, speaker)
        output_path = OUTPUT_DIR / "ainy_test.wav"

        sf.write(
            str(output_path),
            waveform,
            sample_rate
        )

        print(f"Generated audio: {output_path}")

        return output_path

    def generate_audio(self, text, speaker=DEFAULT_SPEAKER):
        waveform, sample_rate = self._synthesize(text, speaker)
        audio_buffer = BytesIO()
        sf.write(audio_buffer, waveform, sample_rate, format="WAV")
        return audio_buffer.getvalue()


if __name__ == "__main__":

    engine = VoiceEngine()

    engine.generate(
        "Hola, soy Ainy. Estoy probando mi nueva voz. "
        "Me alegra poder hablar contigo."
    )
