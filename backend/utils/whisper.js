const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function isWhisperAvailable() {
  return new Promise(resolve => {
    if (String(process.env.WHISPER_ENABLED || '').toLowerCase() === 'force_off') {
      resolve(false);
      return;
    }

    const proc = spawn('whisper', ['--help'], { stdio: 'ignore' });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function generateSubtitles(videoPath, outputDir, model = 'large-v3') {
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const expectedSrt = path.join(outputDir, `${baseName}.srt`);
  const firstTry = await runWhisper(videoPath, outputDir, expectedSrt, model);
  if (firstTry || model === 'base') return firstTry;

  console.warn(`  [Whisper] Retrying ${path.basename(videoPath)} with base model.`);
  return runWhisper(videoPath, outputDir, expectedSrt, 'base');
}

function runWhisper(videoPath, outputDir, expectedSrt, model) {
  return new Promise(resolve => {
    console.log(`  [Whisper] Transcribing: ${path.basename(videoPath)} (model: ${model})`);

    const proc = spawn('whisper', [
      videoPath,
      '--model', model,
      '--output_format', 'srt',
      '--output_dir', outputDir
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(expectedSrt)) {
        console.log(`  [Whisper] Generated: ${path.basename(expectedSrt)}`);
        resolve(expectedSrt);
      } else {
        console.warn(`  [Whisper] Failed with model ${model} (code ${code}).`);
        resolve(null);
      }
    });

    proc.on('error', err => {
      console.warn(`  [Whisper] Not available: ${err.message}.`);
      resolve(null);
    });
  });
}

module.exports = {
  isWhisperAvailable,
  generateSubtitles
};
