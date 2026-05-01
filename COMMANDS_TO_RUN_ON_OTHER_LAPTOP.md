# Commands to run on the other laptop

Run these from the project root. I did not install anything on this machine.

## 1. Verify required tools

```powershell
node -v
npm -v
ffmpeg -version
ffprobe -version
if (Test-Path .\ffmpeg\ffmpeg.exe) { .\ffmpeg\ffmpeg.exe -version }
if (Test-Path .\ffmpeg\ffprobe.exe) { .\ffmpeg\ffprobe.exe -version }
python --version
pip --version
```

## 2. Install project packages

```powershell
npm install
cd backend
npm install
cd ..\frontend
npm install
cd ..
```

## 3. Optional AI packages for full local analysis

Use this only on the laptop where you want Whisper subtitles, face-aware crop, and local AI analysis.

```powershell
pip install -U openai-whisper
pip install -U opencv-python mediapipe numpy
```

For GPU Whisper on an NVIDIA laptop, install the correct PyTorch build for your CUDA version before Whisper. Example for CUDA 12.1:

```powershell
pip install -U torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -U openai-whisper
```

## 4. Create backend config

```powershell
cd backend
copy .env.example .env
cd ..
```

Edit `backend\.env` if needed. For best subtitles set:

```env
WHISPER_ENABLED=true
WHISPER_MODEL=large-v3
WHISPER_CLIP_MODEL=large-v3
```

## 5. Run the app

Terminal 1:

```powershell
cd backend
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm start
```

Open:

```text
http://localhost:4200
```

## 6. Build and syntax check

```powershell
cd frontend
npm run build -- --configuration development
cd ..\backend
node --check server.js
```
