# 🎬 Video Splitter for Shorts

A full-stack web application that takes any video file, automatically splits it into short clips, converts them to **vertical format (1080×1920)**, overlays "Part X" labels, and optionally adds AI-generated subtitles. The output clips are ready to upload to **YouTube Shorts**, **Instagram Reels**, and **TikTok**.

![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![FFmpeg](https://img.shields.io/badge/FFmpeg-8.1-007808?logo=ffmpeg)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📤 **Drag & Drop Upload** | Drag a video onto the page or click to browse — supports **all video formats** (MP4, MKV, AVI, MOV, WebM, WMV, FLV, MPEG, and more) |
| ✂️ **Auto Split** | Automatically splits the video into clips of configurable duration (30s / 60s / 90s / 120s / 180s) |
| 📐 **Vertical Conversion** | Resizes every clip to **1080×1920** (9:16 portrait) with aspect-ratio-preserving letterboxing — no distortion |
| 🏷️ **Part Labels** | Overlays "Part 1", "Part 2", etc. on each clip using FFmpeg's `drawtext` filter |
| 🎤 **AI Subtitles (Optional)** | Uses OpenAI Whisper to transcribe speech and burn subtitles into each clip |
| 📊 **Real-Time Progress** | Live progress bar during upload and processing with clip-by-clip status updates |
| 📥 **Preview & Download** | Preview each clip in the browser and download individually or all at once |
| 🌙 **Premium Dark UI** | Dark theme with glassmorphism, gradient accents, and smooth animations |
| 📁 **Up to 5 GB uploads** | Handles large video files efficiently with async background processing |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | [Angular 21](https://angular.dev) | Single-page app with standalone components |
| **Backend** | [Node.js](https://nodejs.org) + [Express](https://expressjs.com) | REST API server |
| **Video Processing** | [FFmpeg](https://ffmpeg.org) | Splitting, resizing, overlaying text, burning subtitles |
| **File Uploads** | [Multer](https://github.com/expressjs/multer) | Multipart file upload handling |
| **Speech-to-Text** | [Whisper](https://github.com/openai/whisper) *(optional)* | AI-powered subtitle generation |
| **Styling** | SCSS + Google Fonts (Inter) | Dark theme, glassmorphism, responsive design |

---

## 📁 Project Structure

```
my_youtube_shorts_cutter/
│
├── package.json                  # Root scripts (npm run dev starts both servers)
│
├── backend/                      # Node.js + Express API
│   ├── server.js                 # Express entry point, CORS, error handling
│   ├── .env                      # Environment config (ports, limits, features)
│   ├── .env.example              # Example env file for new setups
│   ├── package.json              # Backend dependencies
│   ├── routes/
│   │   └── api.js                # API endpoints (upload, process, status, clips, download)
│   ├── services/
│   │   ├── jobStore.js           # In-memory job state tracking
│   │   └── videoProcessor.js     # Async processing pipeline orchestrator
│   ├── utils/
│   │   ├── ffmpeg.js             # FFmpeg command wrappers (split, resize, label, subtitles)
│   │   └── whisper.js            # Whisper CLI wrapper for subtitle generation
│   ├── uploads/                  # Temporary uploaded files (auto-created)
│   └── outputs/                  # Processed clips organized by job ID (auto-created)
│
├── frontend/                     # Angular 21 SPA
│   ├── src/
│   │   ├── index.html            # Entry HTML with Google Fonts + Material Icons
│   │   ├── styles.scss           # Global dark theme, animations, design tokens
│   │   ├── app/
│   │   │   ├── app.ts            # Root component (switches between upload ↔ clips views)
│   │   │   ├── app.html          # Root template
│   │   │   ├── app.scss          # Root layout styles
│   │   │   ├── app.config.ts     # Angular providers (HttpClient)
│   │   │   ├── services/
│   │   │   │   └── api.service.ts    # HTTP service — all backend API calls
│   │   │   └── components/
│   │   │       ├── header/       # App branding bar with gradient logo
│   │   │       ├── upload/       # Drag-and-drop zone, options panel, progress bar
│   │   │       └── clips/        # Processing status, clips grid, video preview, downloads
│   │   └── ...
│   └── package.json              # Frontend dependencies
│
└── ffmpeg/                       # FFmpeg binaries (auto-downloaded or manually placed)
    ├── ffmpeg.exe
    ├── ffprobe.exe
    └── ffplay.exe
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v20 or higher | [nodejs.org](https://nodejs.org) |
| **npm** | v10+ (comes with Node.js) | — |
| **FFmpeg** | Any recent version | See instructions below |

### Step 1: Install FFmpeg

FFmpeg is the video processing engine. It must be accessible from your terminal.

<details>
<summary><b>🪟 Windows (Recommended — Chocolatey)</b></summary>

Open an **admin** PowerShell and run:
```powershell
choco install ffmpeg -y
```
</details>

<details>
<summary><b>🪟 Windows (Manual Download)</b></summary>

1. Go to [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
2. Download **ffmpeg-release-essentials.zip**
3. Extract to a folder, e.g. `C:\ffmpeg`
4. Add `C:\ffmpeg\bin` to your **System PATH**:
   - Search "Environment Variables" in Windows
   - Edit `Path` → Add `C:\ffmpeg\bin`
5. Restart your terminal
</details>

<details>
<summary><b>🍎 macOS (Homebrew)</b></summary>

```bash
brew install ffmpeg
```
</details>

<details>
<summary><b>🐧 Linux (apt)</b></summary>

```bash
sudo apt update && sudo apt install ffmpeg -y
```
</details>

**Verify it works:**
```bash
ffmpeg -version
ffprobe -version
```
Both should print version info without errors.

---

### Step 2: Clone / Download the Project

```bash
git clone <your-repo-url>
cd my_youtube_shorts_cutter
```

Or download and extract the ZIP.

---

### Step 3: Install Dependencies

**Option A — Install everything in one go:**
```bash
npm run install:all
```

**Option B — Install manually:**
```bash
# Root (for concurrently)
npm install

# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

---

### Step 4: Configure Environment

The backend reads settings from `backend/.env`. A default file is already included. To customize:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=3000                    # Backend server port
UPLOAD_DIR=./uploads         # Where uploaded files are stored temporarily
OUTPUT_DIR=./outputs         # Where processed clips are saved
MAX_FILE_SIZE_MB=5000        # Maximum upload size (5 GB)
DEFAULT_CLIP_DURATION=90     # Default clip length in seconds
WHISPER_ENABLED=false        # Set to true if Whisper is installed
WHISPER_MODEL=base           # Whisper model: tiny, base, small, medium, large
```

---

### Step 5: Run the Application

**Option A — Run both servers with one command (recommended):**
```bash
npm run dev
```
This uses `concurrently` to start the backend and frontend simultaneously.

**Option B — Run servers separately (two terminals):**

Terminal 1 — Backend:
```bash
cd backend
npm run dev
```

Terminal 2 — Frontend:
```bash
cd frontend
npx ng serve --port 4200
```

---

### Step 6: Open in Browser

Navigate to: **[http://localhost:4200](http://localhost:4200)**

---

## 🎯 How to Use

1. **Upload** → Drag and drop any video file onto the upload zone (or click to browse)
2. **Configure** → Choose clip duration (30s – 180s) and toggle subtitles on/off
3. **Process** → Click **"Upload & Process"** — the video is uploaded and processing starts automatically
4. **Watch Progress** → A real-time progress bar shows which clip is being processed
5. **Download** → Preview each clip with the built-in video player, then download individually or all at once

---

## 🔌 API Reference

All endpoints are prefixed with `/api` and the backend runs on port **3000** by default.

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `POST` | `/api/upload` | Upload a video file | `multipart/form-data` with field `video` |
| `POST` | `/api/process` | Start processing a job | `{ jobId, clipDuration?, addSubtitles? }` |
| `GET` | `/api/status/:jobId` | Get job progress | — |
| `GET` | `/api/clips/:jobId` | List processed clips | — |
| `GET` | `/api/download/:jobId/:clipName` | Download a clip | — |
| `GET` | `/api/jobs` | List all jobs | — |

### Example: Status Response
```json
{
  "jobId": "abc-123",
  "status": "processing",
  "progress": 45,
  "totalClips": 10,
  "processedClips": 4,
  "clips": [
    {
      "name": "Part_01.mp4",
      "partNumber": 1,
      "path": "/outputs/abc-123/Part_01.mp4",
      "size": "12.5 MB",
      "duration": "90.0"
    }
  ],
  "error": null
}
```

---

## ⚙️ How It Works — Processing Pipeline

When you upload a video, the backend runs this pipeline asynchronously:

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────────────────┐
│   Upload     │────▶│  Split (FFmpeg)   │────▶│  Per-Segment Processing Loop    │
│   via Multer │     │  -c copy -f       │     │                                 │
│              │     │  segment (fast)   │     │  For each segment:              │
└──────────────┘     └──────────────────┘     │   1. Scale to 1080×1920         │
                                               │   2. Add "Part X" label         │
                                               │   3. Burn subtitles (optional)  │
                                               │   → Single FFmpeg pass          │
                                               └────────────┬────────────────────┘
                                                            │
                                                            ▼
                                               ┌─────────────────────────┐
                                               │  Save to /outputs/{id}/ │
                                               │  Return clip list to UI │
                                               └─────────────────────────┘
```

### Key FFmpeg Commands Used

```bash
# 1. Split video into segments (stream copy — no re-encoding, very fast)
ffmpeg -i input.mp4 -c copy -map 0 -segment_time 90 -f segment -reset_timestamps 1 segment_%03d.mp4

# 2. Resize to vertical + add part label (single encoding pass)
ffmpeg -i segment.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,
       pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,
       drawtext=text='Part 1':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=60" \
  -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
  -movflags +faststart Part_01.mp4

# 3. Optional: Burn subtitles
ffmpeg -i input.mp4 -vf "subtitles=subs.srt" output.mp4
```

> **Why single-pass?** Instead of running 3 separate FFmpeg commands per clip (resize → label → subtitles), all video filters are chained into one `-vf` filterchain. This is ~3× faster and avoids intermediate files.

---

## 🎤 Optional: AI Subtitles with Whisper

To enable automatic subtitle generation:

1. **Install Python 3.9+** from [python.org](https://python.org)
2. **Install Whisper:**
   ```bash
   pip install openai-whisper
   ```
3. **Enable in config** — set `WHISPER_ENABLED=true` in `backend/.env`
4. **Toggle in the UI** — flip the "Add Subtitles" switch before processing

Whisper will transcribe each clip's audio and burn the subtitles directly into the video.

> If Whisper is not installed, the app gracefully skips subtitles without any errors.

---

## 📋 Supported Video Formats

The app accepts **all common video formats** — FFmpeg handles the conversion:

| Format | Extension | Notes |
|--------|-----------|-------|
| MP4 | `.mp4` | Most common |
| Matroska | `.mkv` | Popular for high-quality |
| AVI | `.avi` | Legacy format |
| QuickTime | `.mov` | Apple devices |
| WebM | `.webm` | Web-optimized |
| Windows Media | `.wmv` | Windows |
| Flash Video | `.flv` | Legacy streaming |
| MPEG | `.mpeg`, `.mpg` | Standard |
| 3GPP | `.3gp` | Mobile |
| M4V | `.m4v` | iTunes |
| Transport Stream | `.ts`, `.mts` | Broadcast |
| VOB | `.vob` | DVD |

All clips are output as **MP4 (H.264 + AAC)** for maximum compatibility.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `ffmpeg is not recognized` | FFmpeg is not in your PATH. See [Install FFmpeg](#step-1-install-ffmpeg) |
| `ENOENT: spawn ffmpeg` | Same as above — the backend can't find `ffmpeg` |
| Upload fails for large files | Check `MAX_FILE_SIZE_MB` in `.env` (default: 5000 = 5 GB) |
| Frontend shows blank page | Make sure `ng serve` is running on port 4200 |
| Port 3000 already in use | Change `PORT` in `backend/.env` |
| Subtitles not working | Install Whisper: `pip install openai-whisper` and set `WHISPER_ENABLED=true` |
| Processing takes too long | Large videos take time. Each 90s clip takes ~10–30s to encode depending on your CPU |

---

## 📜 Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend + frontend (from root) |
| `npm run install:all` | Install dependencies for backend + frontend |
| `npm run start:backend` | Start backend only |
| `npm run start:frontend` | Start frontend only |
| `npm run dev:backend` | Start backend with nodemon (auto-restart) |
| `npm run dev:frontend` | Start frontend with Angular dev server |

---

## 📄 License

MIT — free to use, modify, and distribute.
