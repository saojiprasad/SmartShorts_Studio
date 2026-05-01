# SmartShorts Studio

SmartShorts Studio is a local-first AI video editor and viral shorts factory. Upload one long podcast, interview, stream, or lecture, click **Generate Viral Shorts**, and the backend creates short-form clips with scoring, captions, visual polish, sound mix, thumbnails, and upload metadata.

## What It Does

- Uploads long-form videos through the Angular creator dashboard.
- Detects viral clip windows from transcript hooks, audio energy, scene changes, pacing, and retention heuristics.
- Supports creator modes: Auto Viral, Podcast Viral, Debate, Motivational, Educational, Storytelling, Gaming, Finance, Dark Documentary, Comedy, Meme Style, and Cinematic.
- Renders vertical/social clips with face-aware crop fallback, animated ASS captions, dynamic visual polish, progress overlays, optional local B-roll, background music ducking, and normalized audio.
- Generates Shorts/Reels/YouTube thumbnail frames plus titles, descriptions, hashtags, CTA text, scores, and edit-plan metadata.
- Streams live progress to the frontend with Server-Sent Events.

The project does not include or encourage copyright bypassing, DRM removal, watermark removal, or platform-protection bypasses.

## Project Layout

```text
backend/
  ai/                 transcript, scene, audio, scoring, SEO, retention planning
  effects/            captions, auto edit polish, overlays, audio mix, thumbnails
  routes/             upload/process/status/download/SSE API
  services/           job store and processing pipeline
  utils/              FFmpeg, ffprobe, Whisper wrappers
frontend/
  src/app/            Angular dashboard, upload flow, clips/results view
COMMANDS_TO_RUN_ON_OTHER_LAPTOP.md
  exact setup and run commands for your other machine
```

## Setup

I did not install anything on this machine. Use `COMMANDS_TO_RUN_ON_OTHER_LAPTOP.md` on the laptop where you want to run the app.

## Run

Backend:

```powershell
cd backend
npm run dev
```

Frontend:

```powershell
cd frontend
npm start
```

Open `http://localhost:4200`.
