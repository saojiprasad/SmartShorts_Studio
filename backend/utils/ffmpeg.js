/**
 * FFmpeg Utility Functions
 *
 * Wraps all FFmpeg operations used by the video processing pipeline.
 * Each function spawns FFmpeg as a child process and returns a Promise.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Run an FFmpeg command and return a promise.
 *
 * @param {string[]} args - FFmpeg CLI arguments
 * @param {string}   label - Human-readable label for logging
 * @returns {Promise<void>}
 */
function runFFmpeg(args, label = 'FFmpeg') {
  return new Promise((resolve, reject) => {
    console.log(`  ⚙️  [${label}] ffmpeg ${args.join(' ')}`);

    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`[${label}] FFmpeg exited with code ${code}:\n${stderr.slice(-500)}`));
      }
    });

    proc.on('error', err => {
      reject(new Error(`[${label}] Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Probe a video file to get its duration in seconds.
 *
 * Uses ffprobe to extract the duration. Falls back to 0 on error.
 *
 * @param {string} inputPath
 * @returns {Promise<number>} Duration in seconds
 */
function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ]);

    let output = '';
    proc.stdout.on('data', chunk => { output += chunk.toString(); });

    proc.on('close', code => {
      const duration = parseFloat(output.trim());
      resolve(isNaN(duration) ? 0 : duration);
    });

    proc.on('error', () => resolve(0));
  });
}

/**
 * Split a video into segments of a given duration.
 *
 * Uses FFmpeg's segment muxer which copies the streams (no re-encoding)
 * for fast splitting:
 *   ffmpeg -i input.mp4 -c copy -map 0 -segment_time 90
 *          -f segment -reset_timestamps 1 output_%03d.mp4
 *
 * @param {string} inputPath   - Path to the source video
 * @param {string} outputDir   - Directory to write segments into
 * @param {number} duration    - Segment duration in seconds (default 90)
 * @returns {Promise<string[]>} Array of segment file paths
 */
async function splitVideo(inputPath, outputDir, duration = 90) {
  const pattern = path.join(outputDir, 'segment_%03d.mp4');

  await runFFmpeg([
    '-i', inputPath,
    '-c', 'copy',          // Stream copy — no re-encoding, very fast
    '-map', '0:v:0',       // Only the first video stream
    '-map', '0:a?',        // Audio stream if present (? = optional, won't fail if missing)
    '-segment_time', String(duration),
    '-f', 'segment',       // Use the segment muxer
    '-reset_timestamps', '1',
    pattern
  ], 'Split');

  // Read back which segment files were created
  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('segment_') && f.endsWith('.mp4'))
    .sort()
    .map(f => path.join(outputDir, f));

  return files;
}

/**
 * Resolution presets for different aspect ratios.
 * Each entry maps a ratio string to { width, height }.
 */
const RESOLUTION_MAP = {
  '9:16':  { w: 1080, h: 1920 },  // YouTube Shorts, Reels, TikTok
  '16:9':  { w: 1920, h: 1080 },  // YouTube landscape
  '1:1':   { w: 1080, h: 1080 },  // Instagram square
  '4:5':   { w: 1080, h: 1350 },  // Instagram feed
};

/**
 * Process a single segment: resize to target aspect ratio + overlay part label.
 *
 * Combines scaling and text overlay into a single FFmpeg filter chain
 * for efficiency (one encoding pass instead of two).
 *
 * The scale+pad approach preserves the original aspect ratio and adds
 * black bars (letterboxing/pillarboxing) instead of stretching/distorting.
 *
 * @param {string} inputPath    - Path to the raw segment
 * @param {string} outputPath   - Where to write the processed clip
 * @param {number} partNumber   - Part number for the overlay label
 * @param {string|null} srtPath - Optional path to .srt subtitle file
 * @param {string} aspectRatio  - Target aspect ratio: '9:16', '16:9', '1:1', '4:5'
 * @returns {Promise<void>}
 */
async function processSegment(inputPath, outputPath, partNumber, srtPath = null, aspectRatio = '9:16') {
  // Look up resolution, default to 9:16 if unknown
  const res = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];
  const { w, h } = res;

  // Build the video filter chain
  const filters = [
    // Scale to fit within target resolution, preserving aspect ratio
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    // Pad to exactly target resolution with black bars if needed
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
    // Overlay "Part X" label at the top center
    `drawtext=text='Part ${partNumber}':fontsize=56:fontcolor=white:` +
    `x=(w-text_w)/2:y=60:borderw=3:bordercolor=black@0.8:` +
    `box=1:boxcolor=black@0.4:boxborderw=12`
  ];

  // If subtitles file exists, burn them in
  if (srtPath && fs.existsSync(srtPath)) {
    // Escape path for FFmpeg filter (replace backslashes and colons)
    const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filters.push(
      `subtitles='${escapedSrt}':force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=80'`
    );
  }

  await runFFmpeg([
    '-i', inputPath,
    '-vf', filters.join(','),
    '-c:v', 'libx264',      // H.264 encoding
    '-preset', 'fast',       // Faster encoding, slightly larger file
    '-crf', '23',            // Good quality (lower = better, 18–28 range)
    '-c:a', 'aac',           // AAC audio
    '-b:a', '128k',
    '-movflags', '+faststart', // Enable progressive download
    '-y',                    // Overwrite output if exists
    outputPath
  ], `Process Part ${partNumber} (${w}×${h})`);
}

module.exports = {
  runFFmpeg,
  getVideoDuration,
  splitVideo,
  processSegment
};
