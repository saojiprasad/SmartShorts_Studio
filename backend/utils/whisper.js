/**
 * Whisper Utility — Speech-to-text subtitle generation
 *
 * Uses OpenAI's Whisper CLI (Python) to transcribe audio from a video
 * segment and produce an .srt subtitle file.
 *
 * Prerequisites:
 *   pip install openai-whisper
 *   (Requires Python 3.9+)
 *
 * Whisper command:
 *   whisper segment.mp4 --model base --output_format srt --output_dir <dir>
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Check if Whisper is available on the system.
 * @returns {Promise<boolean>}
 */
function isWhisperAvailable() {
  return new Promise(resolve => {
    const proc = spawn('whisper', ['--help'], { stdio: 'ignore' });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Generate subtitles (.srt) for a video file using Whisper.
 *
 * @param {string} videoPath  - Path to the video/audio file
 * @param {string} outputDir  - Directory to write the .srt file
 * @param {string} model      - Whisper model size: tiny, base, small, medium, large
 * @returns {Promise<string|null>} Path to the generated .srt file, or null on failure
 */
async function generateSubtitles(videoPath, outputDir, model = 'base') {
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const expectedSrt = path.join(outputDir, `${baseName}.srt`);

  return new Promise((resolve, reject) => {
    console.log(`  🎤 [Whisper] Transcribing: ${path.basename(videoPath)} (model: ${model})`);

    const proc = spawn('whisper', [
      videoPath,
      '--model', model,
      '--output_format', 'srt',
      '--output_dir', outputDir
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(expectedSrt)) {
        console.log(`  ✅ [Whisper] Generated: ${path.basename(expectedSrt)}`);
        resolve(expectedSrt);
      } else {
        console.warn(`  ⚠️  [Whisper] Failed (code ${code}). Proceeding without subtitles.`);
        resolve(null); // Non-fatal: continue without subtitles
      }
    });

    proc.on('error', err => {
      console.warn(`  ⚠️  [Whisper] Not available: ${err.message}. Proceeding without subtitles.`);
      resolve(null); // Non-fatal
    });
  });
}

module.exports = {
  isWhisperAvailable,
  generateSubtitles
};
