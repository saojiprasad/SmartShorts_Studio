# Commands to run on the other laptop

Run these from the project root on the laptop where you want to process videos. I did not install anything on this machine.

## 1. Verify required tools

```powershell
node -v
npm -v
ffmpeg -version
ffprobe -version
python --version
pip --version
```

If you are using bundled FFmpeg binaries in this repo:

```powershell
if (Test-Path .\ffmpeg\ffmpeg.exe) { .\ffmpeg\ffmpeg.exe -version }
if (Test-Path .\ffmpeg\ffprobe.exe) { .\ffmpeg\ffprobe.exe -version }
```

## 2. Install Node packages

```powershell
npm install
cd backend
npm install
cd ..\frontend
npm install
cd ..
```

## 3. Install Python AI packages

Recommended:

```powershell
cd backend\python_ai
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
cd ..\..
```

Advanced install for stronger transcription, emotion detection, diarization helpers, and audio cleanup:

```powershell
cd backend\python_ai
.\.venv\Scripts\activate
pip install -r requirements-advanced.txt
cd ..\..
```

If your laptop has an NVIDIA GPU, install the correct PyTorch build before Whisper. Example for CUDA 12.1:

```powershell
pip install -U torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
cd backend\python_ai
.\.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-advanced.txt
cd ..\..
```

## 4. Optional Redis queue

Redis is optional. The app works without it. Use Redis if you want BullMQ queue behavior.

Windows options:

```powershell
winget install Memurai.MemuraiDeveloper
```

Or run Redis with Docker:

```powershell
docker run --name smartshorts-redis -p 6379:6379 -d redis:7
```

Or use the included compose file:

```powershell
docker compose up -d redis
```

Verify:

```powershell
redis-cli ping
```

## 5. Add local sound effects and music

Put SFX files here:

```text
backend\assets\sfx\
```

Expected filenames:

```text
boom.mp3
whoosh.mp3
click.mp3
clap.mp3
laugh.mp3
```

Put background music here:

```text
backend\assets\music\
```

Suggested filenames:

```text
hype.mp3
upbeat.mp3
lofi.mp3
cinematic.mp3
inspire.mp3
suspense.mp3
dark.mp3
fun.mp3
meme.mp3
premium.mp3
```

Use only royalty-free, licensed, or self-created audio.

## 6. Create backend config

```powershell
cd backend
copy .env.example .env
cd ..
```

Recommended `.env` for normal local use:

```env
PORT=3000
WHISPER_ENABLED=auto
WHISPER_MODEL=large-v3
WHISPER_CLIP_MODEL=large-v3
FFMPEG_PRESET=fast
FFMPEG_CRF=22
FFMPEG_THREADS=0
QUEUE_ENABLED=false
PYTHON_AI_URL=http://127.0.0.1:8001
PYTHON_AI_ENABLED=false
```

If Redis is installed and running:

```env
QUEUE_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
VIDEO_WORKER_CONCURRENCY=1
```

If you want the backend to call the Python AI service:

```env
PYTHON_AI_ENABLED=true
PYTHON_AI_URL=http://127.0.0.1:8001
```

## 7. Run the optional Python AI service

Terminal 1:

```powershell
cd backend\python_ai
.\.venv\Scripts\activate
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Open:

```text
http://127.0.0.1:8001/health
```

## 8. Run the backend

Terminal 2:

```powershell
cd backend
npm run dev
```

If Redis queue is enabled:

```powershell
cd backend
npm run dev:queue
```

## 9. Run the frontend

Terminal 3:

```powershell
cd frontend
npm start
```

Open:

```text
http://localhost:4200
```

## 10. Build and syntax check

```powershell
cd frontend
npm run build -- --configuration development
cd ..\backend
node --check server.js
node --check services\videoProcessor.js
node --check effects\finalRenderer.js
```
