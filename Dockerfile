FROM python:3.12-slim

ENV PORT=8080 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENABLE_LOCAL_TTS=true \
    PIPER_MODEL_PATH=/home/user/app/tts/models/en_US-mike-medium.onnx

RUN useradd --create-home --uid 1000 --user-group user
WORKDIR /home/user/app

RUN apt-get update \
    && apt-get install --no-install-recommends -y libespeak-ng1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-tts.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-tts.txt

COPY --chown=1000:1000 app.py ./app.py
COPY --chown=1000:1000 tts/ ./tts/

USER user
RUN python -m piper.download_voices en_US-mike-medium --download-dir /home/user/app/tts/models

EXPOSE 8080
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 app:app"]
