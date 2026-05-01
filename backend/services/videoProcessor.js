/**
 * Video Processor Service
 *
 * Orchestrates the full processing pipeline for a video job:
 *   1. Split the uploaded video into N-second segments
 *   2. For each segment, optionally generate subtitles (Whisper)
 *   3. Process each segment: resize to vertical + add part label + burn subtitles
 *   4. Update job state throughout for real-time progress tracking
 */

const path = require('path');
const fs = require('fs');
const { splitVideo, processSegment, getVideoDuration } = require('../utils/ffmpeg');
const { generateSubtitles, isWhisperAvailable } = require('../utils/whisper');
const { updateJob, JobStatus } = require('./jobStore');

const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './outputs');

/**
 * Process a video job asynchronously.
 *
 * This function is fire-and-forget — it updates the job store as it progresses
 * so the frontend can poll for status.
 *
 * @param {object} job - The job object from the job store
 */
async function processVideo(job) {
  const { jobId, originalFile, options } = job;
  const clipDuration = options.clipDuration || parseInt(process.env.DEFAULT_CLIP_DURATION) || 90;
  const addSubtitles = options.addSubtitles || false;
  const aspectRatio = options.aspectRatio || '9:16';

  // Create job-specific output directory
  const jobOutputDir = path.join(OUTPUT_DIR, jobId);
  const segmentsDir = path.join(jobOutputDir, 'segments');
  fs.mkdirSync(segmentsDir, { recursive: true });

  try {
    console.log(`\n🎬 [Job ${jobId}] Starting processing...`);
    console.log(`   Source: ${path.basename(originalFile)}`);
    console.log(`   Clip duration: ${clipDuration}s`);
    console.log(`   Aspect ratio: ${aspectRatio}`);
    console.log(`   Subtitles: ${addSubtitles ? 'Yes' : 'No'}`);

    updateJob(jobId, { status: JobStatus.PROCESSING, progress: 5 });

    // ── Step 1: Get video duration ──────────────────────────────────
    const totalDuration = await getVideoDuration(originalFile);
    console.log(`   Duration: ${totalDuration.toFixed(1)}s`);

    // ── Step 2: Split video into segments ───────────────────────────
    console.log(`\n📂 [Job ${jobId}] Splitting into ${clipDuration}s segments...`);
    updateJob(jobId, { progress: 10 });

    const segmentFiles = await splitVideo(originalFile, segmentsDir, clipDuration);
    const totalClips = segmentFiles.length;

    console.log(`   Found ${totalClips} segment(s)`);
    updateJob(jobId, { totalClips, progress: 20 });

    // ── Step 3: Check Whisper availability if subtitles requested ───
    let whisperAvailable = false;
    if (addSubtitles) {
      whisperAvailable = await isWhisperAvailable();
      if (!whisperAvailable) {
        console.log(`   ⚠️  Whisper not available — skipping subtitles`);
      }
    }

    // ── Step 4: Process each segment ────────────────────────────────
    const processedClips = [];

    for (let i = 0; i < segmentFiles.length; i++) {
      const partNumber = i + 1;
      const segmentPath = segmentFiles[i];
      const outputFileName = `Part_${String(partNumber).padStart(2, '0')}.mp4`;
      const outputPath = path.join(jobOutputDir, outputFileName);

      console.log(`\n🔄 [Job ${jobId}] Processing Part ${partNumber}/${totalClips}...`);

      // Optionally generate subtitles for this segment
      let srtPath = null;
      if (addSubtitles && whisperAvailable) {
        srtPath = await generateSubtitles(segmentPath, segmentsDir, process.env.WHISPER_MODEL || 'base');
      }

      // Process: resize + add part label + optional subtitles
      await processSegment(segmentPath, outputPath, partNumber, srtPath, aspectRatio);

      // Get file size for the UI
      const stats = fs.statSync(outputPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Get duration of processed clip
      const clipDur = await getVideoDuration(outputPath);

      processedClips.push({
        name: outputFileName,
        partNumber,
        path: `/outputs/${jobId}/${outputFileName}`,
        size: `${fileSizeMB} MB`,
        sizeBytes: stats.size,
        duration: clipDur.toFixed(1)
      });

      // Update progress: 20% (split done) + 80% spread across segments
      const segmentProgress = 20 + Math.round(((i + 1) / totalClips) * 75);
      updateJob(jobId, {
        processedClips: partNumber,
        clips: [...processedClips],
        progress: Math.min(segmentProgress, 95)
      });

      console.log(`   ✅ Part ${partNumber} done (${fileSizeMB} MB, ${clipDur.toFixed(1)}s)`);
    }

    // ── Step 5: Cleanup raw segments ────────────────────────────────
    try {
      fs.rmSync(segmentsDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`   ⚠️  Could not clean up segments dir: ${e.message}`);
    }

    // ── Done ────────────────────────────────────────────────────────
    updateJob(jobId, {
      status: JobStatus.COMPLETED,
      progress: 100,
      clips: processedClips
    });

    console.log(`\n🎉 [Job ${jobId}] Complete! ${processedClips.length} clip(s) generated.\n`);

  } catch (error) {
    console.error(`\n❌ [Job ${jobId}] Failed:`, error.message);
    updateJob(jobId, {
      status: JobStatus.FAILED,
      error: error.message,
      progress: 0
    });
  }
}

module.exports = { processVideo };
