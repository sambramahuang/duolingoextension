# LingoLens Media Studio

Creator-side upload studio that grades influencer videos for language-learning quality.

## What is included

- Upload UI for local video files
- Flask backend API (`/api/analyze`) for real scoring
- Audio extraction with FFmpeg
- Transcription with OpenAI speech-to-text
- Transcript scoring + frame-based visual quality scoring
- Combined 0-100 score plus recommendations and teachable phrase translations
- Frontend fallback to mock scoring if backend is unavailable

## Backend requirements

- Python 3.10+
- FFmpeg installed and available on `PATH`
- `OPENAI_API_KEY` in environment (or `.env`)

## Setup

1. Install dependencies:
   `pip install -r requirements.txt`
2. Create `.env` from `.env.example` and set:
   `OPENAI_API_KEY=...`
3. Start backend:
   `python server.py`
4. Open the app:
   `http://localhost:5001`

## API endpoints

- `GET /api/health` — service status, key/ffmpeg readiness
- `POST /api/analyze` — multipart upload with `video` + metadata fields

Metadata fields supported:
- `title`, `description`
- `target_language_code`, `target_language_name`, `target_language`
- `learner_level`, `category`, `topics`
- `has_subtitles`, `native_speaker`, `slow_speech`

## Notes

- Max upload size is 500MB.
- Backend returns structured scores and metrics for the results panel.
- If the API is down, frontend automatically uses demo/mock scoring.
