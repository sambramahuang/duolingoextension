# LingoLens Media Studio

Front-end-only webpage prototype for a Duolingo feature that scores TikTok, Instagram, YouTube, or uploaded videos based on how useful they are for learning a target language.

## What is included

- Standalone webpage interface with a polished feature-demo layout
- Media intake form for URL paste or local video upload
- Target language, learner level, and learning-goal selectors
- Mock scoring result with metric breakdown, strengths, cautions, and Duolingo follow-up actions
- Demo library of sample videos from TikTok, Instagram, and YouTube concepts
- Shared mock scoring logic stored locally in the browser

## Current limitations

- No backend yet
- No real scraping or ingestion
- No transcript, subtitle, or speech analysis yet
- Scores are demo estimates only

## Run the page

You can open `index.html` directly in a browser, but using a tiny local server is cleaner:

1. In this folder, run `python3 -m http.server 4173`
2. Open `http://localhost:4173`

## Try the prototype

1. Paste a TikTok, Instagram, or YouTube URL, or choose a local video file.
2. Pick the target language, learner level, and learning goal.
3. Click **Run Demo Analysis**.
4. Review the score and explanation.
5. Click the demo cards to simulate how Duolingo might surface recommended media.

## Good next steps

- Add a backend for transcript extraction and feature scoring
- Connect platform ingestion or file upload processing
- Save analyzed clips into playlists or practice queues
- Turn high-value lines into flashcards, shadowing drills, and listening tasks
