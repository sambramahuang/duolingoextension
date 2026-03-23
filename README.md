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

## Deploy backend to Vercel

1. Install Vercel CLI and log in:
   `npm i -g vercel`
   `vercel login`
2. Deploy:
   `vercel`
3. Set required env var in Vercel project settings:
   `OPENAI_API_KEY`
4. (Optional) Set custom upload cap:
   `UPLOAD_LIMIT_MB` (defaults to `4.5` on Vercel, `500` locally)

### Important Vercel limits for this project

- Vercel Functions have a **4.5MB request body limit**. This means direct large video uploads to `/api/analyze` will fail on Vercel.
- This project uses FFmpeg for audio/frame extraction. It now falls back to a bundled FFmpeg binary via `imageio-ffmpeg` if system FFmpeg is unavailable. You can still override with `FFMPEG_BIN`.
- If you need a longer function timeout, set Function Max Duration in Vercel project settings.

For production with larger videos, use direct upload to object storage + async worker processing, then call OpenAI/FFmpeg from that worker.
