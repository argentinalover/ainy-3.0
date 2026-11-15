import unittest
from unittest.mock import patch

import app


class TextToSpeechTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    @patch.object(app, "ENABLE_LOCAL_TTS", False)
    @patch.object(app, "get_voice_engine")
    def test_disabled_tts_does_not_load_model(self, get_voice_engine):
        response = self.client.post("/api/tts", json={"text": "Hello"})

        self.assertEqual(response.status_code, 503)
        self.assertIn("disabled", response.json["error"])
        get_voice_engine.assert_not_called()

    @patch.object(app, "ENABLE_LOCAL_TTS", True)
    @patch.object(app, "get_voice_engine")
    def test_enabled_tts_returns_audio(self, get_voice_engine):
        get_voice_engine.return_value.generate_audio.return_value = b"wav-data"

        response = self.client.post("/api/tts", json={"text": "Hello"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "audio/wav")
        self.assertEqual(response.data, b"wav-data")


class ChatPromptTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    @patch.object(app, "GEMINI_CLIENT", None)
    def test_basic_mode_reply_is_in_english(self):
        response = self.client.post("/api/chat", json={"message": "Hello"})

        self.assertEqual(response.status_code, 200)
        self.assertIn("The backend is running in basic mode", response.json["response"])

    @patch.object(app, "GEMINI_CLIENT")
    @patch.object(app, "GEMINI_SYSTEM_INSTRUCTION", "")
    def test_gemini_has_no_system_instruction_by_default(self, gemini_client):
        gemini_client.models.generate_content.return_value.text = "Hello."

        response = self.client.post("/api/chat", json={"message": "Hello"})

        self.assertEqual(response.status_code, 200)
        config = gemini_client.models.generate_content.call_args.kwargs["config"]
        self.assertIsNone(config.system_instruction)

    @patch.object(app, "GEMINI_CLIENT")
    @patch.object(app, "GEMINI_SYSTEM_INSTRUCTION", "Custom future prompt")
    def test_gemini_uses_configured_system_instruction(self, gemini_client):
        gemini_client.models.generate_content.return_value.text = "Hello."

        response = self.client.post("/api/chat", json={"message": "Hello"})

        self.assertEqual(response.status_code, 200)
        config = gemini_client.models.generate_content.call_args.kwargs["config"]
        self.assertEqual(config.system_instruction, "Custom future prompt")


if __name__ == "__main__":
    unittest.main()
