const path = require('path');
const fs = require('fs');
const { runPipeline } = require('./pipelineManager');
const { getVideoDuration, splitVideo, cutClip, processSegment } = require('../utils/ffmpeg');
const { getVideoMetadata } = require('../utils/ffprobe');
const { generateSubtitles, isWhisperAvailable } = require('../utils/whisper');
const { generateSmartClips } = require('../ai/smartClipper');
const { buildSeoPackage } = require('../ai/seoEngine');
const { createEditPlan, normalizeMode } = require('../ai/retentionOptimizer');
const { scoreClipViral, generateTips } = require('../ai/viralScorer');
const { generateStyledSubtitles } = require('../effects/subtitleStyler');
const { applyProgressOverlay } = require('../effects/overlays');
const { applyAudioMix } = require('../effects/audioMixer');
const { applyCreatorPolish } = require('../effects/autoEditor');
const { addBRoll } = require('../effects/effectsEngine');
const { generateThumbnailPack } = require('../effects/thumbnailGenerator');
const { updateJob } = require('./jobStore');

const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './outputs');

function removeIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`[Cleanup] Could not remove ${filePath}: ${error.message}`);
  }
}

function getLocalBrollFile() {
  const brollDir = path.resolve(__dirname, '../broll');
  if (!fs.existsSync(brollDir)) return null;
  const files = fs.readdirSync(brollDir).filter(file => file.toLowerCase().endsWith('.mp4')).sort();
  return files.length ? path.join(brollDir, files[0]) : null;
}

function buildFixedClip(file, index, options) {
  const duration = Number(options.clipDuration) || 45;
  const clip = {
    index,
    path: file,
    start: index * duration,
    end: (index + 1) * duration,
    duration,
    viralScore: 35,
    hookText: '',
    emotion: 'neutral',
    reason: 'Fixed duration split',
    details: {
      hookScore: 0,
      energyScore: 30,
      sceneScore: 15,
      pacingScore: 30,
      retentionScore: 35,
      engagementPrediction: 30,
      replayPotential: 25
    }
  };
  const scored = scoreClipViral(clip);
  const seo = buildSeoPackage({ ...clip, viralScore: scored.viralScore }, normalizeMode(options.mode || 'auto_viral'));
  return {
    ...clip,
    viralScore: scored.viralScore,
    grade: scored.grade,
    title: seo.title,
    description: seo.description,
    hashtags: seo.hashtags,
    seo
  };
}

const PIPELINE_STEPS = [
  {
    name: 'analyze',
    description: 'Analyzing source video, audio, and format',
    execute: async (ctx, progress) => {
      progress(15);
      const metadata = await getVideoMetadata(ctx.originalFile);
      progress(60);
      const totalDuration = await getVideoDuration(ctx.originalFile);
      const analysis = {
        metadata,
        totalDuration,
        source: path.basename(ctx.originalFile),
        mode: normalizeMode(ctx.options.mode || 'auto_viral')
      };
      updateJob(ctx.jobId, { analysis });
      progress(100);
      return { metadata, totalDuration, analysis };
    }
  },
  {
    name: 'transcribe_full',
    description: 'Creating transcript for hook and subtitle analysis',
    execute: async (ctx, progress) => {
      const needsTranscript = ctx.options.clippingMode === 'smart' || ctx.options.addSubtitles;
      if (!needsTranscript) {
        progress(100);
        return { fullSrt: null, whisperAvailable: false };
      }

      progress(10);
      const whisperAvailable = await isWhisperAvailable();
      if (!whisperAvailable) {
        progress(100);
        return { fullSrt: null, whisperAvailable: false };
      }

      const model = process.env.WHISPER_MODEL || 'large-v3';
      const fullSrt = await generateSubtitles(ctx.originalFile, ctx.segmentsDir, model);
      progress(100);
      return { fullSrt, whisperAvailable: Boolean(fullSrt) };
    }
  },
  {
    name: 'detect_viral_moments',
    description: 'Scoring hooks, emotion, pacing, and retention windows',
    execute: async (ctx, progress) => {
      let clipsToProcess = [];
      const mode = normalizeMode(ctx.options.mode || 'auto_viral');

      if (ctx.options.clippingMode === 'smart') {
        const smartClips = await generateSmartClips(
          ctx.originalFile,
          ctx.fullSrt,
          mode,
          percent => progress(5 + percent * 0.75)
        );

        for (let i = 0; i < smartClips.length; i++) {
          const clip = smartClips[i];
          const segmentPath = path.join(ctx.segmentsDir, `segment_${String(i).padStart(3, '0')}.mp4`);
          await cutClip(ctx.originalFile, segmentPath, clip.start, clip.duration);
          clipsToProcess.push({ index: i, path: segmentPath, ...clip });
          progress(80 + ((i + 1) / Math.max(1, smartClips.length)) * 18);
        }
      } else {
        const segmentFiles = await splitVideo(ctx.originalFile, ctx.segmentsDir, ctx.options.clipDuration);
        clipsToProcess = segmentFiles.map((file, index) => buildFixedClip(file, index, ctx.options));
      }

      updateJob(ctx.jobId, {
        totalClips: clipsToProcess.length,
        analysis: {
          ...ctx.analysis,
          selectedMoments: clipsToProcess.map(clip => ({
            start: clip.start,
            end: clip.end,
            duration: clip.duration,
            viralScore: clip.viralScore,
            reason: clip.reason,
            hookText: clip.hookText
          }))
        }
      });

      progress(100);
      return { clipsToProcess };
    }
  },
  {
    name: 'render_creator_edits',
    description: 'Rendering captions, effects, audio mix, thumbnails, and SEO',
    execute: async (ctx, progress) => {
      const processedClips = [];
      const thumbnails = [];
      const titles = [];
      const total = ctx.clipsToProcess.length;
      const mode = normalizeMode(ctx.options.mode || 'auto_viral');

      if (total === 0) {
        progress(100);
        return { processedClips: [] };
      }

      for (let i = 0; i < total; i++) {
        const clip = ctx.clipsToProcess[i];
        const partNumber = i + 1;
        const partPrefix = `Part_${String(partNumber).padStart(2, '0')}`;
        const basePath = path.join(ctx.jobOutputDir, `${partPrefix}_base.mp4`);
        const editPath = path.join(ctx.jobOutputDir, `${partPrefix}_edit.mp4`);
        const brollPath = path.join(ctx.jobOutputDir, `${partPrefix}_broll.mp4`);
        const overlayPath = path.join(ctx.jobOutputDir, `${partPrefix}_overlay.mp4`);
        const finalPath = path.join(ctx.jobOutputDir, `${partPrefix}.mp4`);
        const finalOutputName = `${partPrefix}.mp4`;

        const editPlan = createEditPlan(clip, mode);
        const seo = clip.seo || buildSeoPackage(clip, mode);
        const enrichedClip = { ...clip, editPlan, seo, title: seo.title, description: seo.description, hashtags: seo.hashtags };

        let subtitlePath = null;
        if (ctx.options.addSubtitles && ctx.whisperAvailable) {
          const clipModel = process.env.WHISPER_CLIP_MODEL || process.env.WHISPER_MODEL || 'large-v3';
          const segSrt = await generateSubtitles(clip.path, ctx.segmentsDir, clipModel);
          if (segSrt) {
            const assPath = segSrt.replace(/\.srt$/i, '.ass');
            subtitlePath = generateStyledSubtitles(segSrt, assPath, ctx.options.subtitleStyle || 'hormozi') || segSrt;
          }
        }

        await processSegment(
          clip.path,
          basePath,
          partNumber,
          subtitlePath,
          ctx.options.aspectRatio,
          ctx.options.cropMode
        );

        let currentLayerPath = basePath;
        try {
          await applyCreatorPolish(currentLayerPath, editPath, ctx.options, enrichedClip);
          currentLayerPath = editPath;
        } catch (error) {
          console.warn(`[AutoEdit] Visual polish skipped for part ${partNumber}: ${error.message}`);
        }

        if (ctx.options.enableBroll) {
          const brollFile = getLocalBrollFile();
          if (brollFile) {
            try {
              await addBRoll(currentLayerPath, brollFile, brollPath);
              currentLayerPath = brollPath;
            } catch (error) {
              console.warn(`[Broll] B-roll skipped for part ${partNumber}: ${error.message}`);
            }
          }
        }

        try {
          await applyProgressOverlay(currentLayerPath, overlayPath, clip.duration);
          currentLayerPath = overlayPath;
        } catch (error) {
          console.warn(`[Overlay] Progress overlay skipped for part ${partNumber}: ${error.message}`);
        }

        const musicPath = path.resolve(__dirname, '../assets/lofi_beat.mp3');
        if (ctx.options.enableAudio !== false && fs.existsSync(musicPath)) {
          try {
            await applyAudioMix(currentLayerPath, finalPath, musicPath, ctx.options.musicVolume || 0.14);
          } catch (error) {
            console.warn(`[Audio] Mix skipped for part ${partNumber}: ${error.message}`);
            fs.copyFileSync(currentLayerPath, finalPath);
          }
        } else {
          fs.copyFileSync(currentLayerPath, finalPath);
        }

        const publicBasePath = `/outputs/${ctx.jobId}`;
        let thumbnailPack = {};
        try {
          thumbnailPack = await generateThumbnailPack(finalPath, ctx.jobOutputDir, publicBasePath, enrichedClip, partNumber);
          thumbnails.push(thumbnailPack);
        } catch (error) {
          console.warn(`[Thumbnail] Thumbnail generation skipped for part ${partNumber}: ${error.message}`);
        }

        [basePath, editPath, brollPath, overlayPath].forEach(file => {
          if (file !== finalPath) removeIfExists(file);
        });

        const stats = fs.statSync(finalPath);
        const scores = scoreClipViral(enrichedClip);
        const tips = generateTips(scores);
        const outputClip = {
          name: finalOutputName,
          partNumber,
          path: `${publicBasePath}/${finalOutputName}`,
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          sizeBytes: stats.size,
          duration: Number(clip.duration).toFixed(1),
          start: clip.start,
          end: clip.end,
          viralScore: Math.max(clip.viralScore || 0, scores.viralScore),
          grade: scores.grade,
          hookText: enrichedClip.hookText,
          title: seo.title,
          description: seo.description,
          hashtags: seo.hashtags,
          seo,
          reason: enrichedClip.reason,
          emotion: enrichedClip.emotion,
          details: {
            ...enrichedClip.details,
            retentionScore: enrichedClip.details?.retentionScore || scores.retentionScore
          },
          tips,
          editPlan,
          thumbnails: thumbnailPack
        };

        processedClips.push(outputClip);
        titles.push(seo.title);
        updateJob(ctx.jobId, {
          clips: [...processedClips],
          processedClips: partNumber,
          totalClips: total,
          thumbnails: [...thumbnails],
          titles: [...titles]
        });
        progress(((i + 1) / total) * 100);
      }

      return { processedClips, thumbnails, titles };
    }
  },
  {
    name: 'cleanup',
    description: 'Cleaning temporary render files',
    execute: async (ctx, progress) => {
      try {
        fs.rmSync(ctx.segmentsDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[Cleanup] ${error.message}`);
      }
      progress(100);
      return {};
    }
  }
];

async function processVideo(job) {
  const { jobId, originalFile, options } = job;
  const jobOutputDir = path.join(OUTPUT_DIR, jobId);
  const segmentsDir = path.join(jobOutputDir, 'segments');
  fs.mkdirSync(segmentsDir, { recursive: true });

  const context = {
    jobId,
    originalFile,
    options,
    jobOutputDir,
    segmentsDir
  };

  try {
    const finalCtx = await runPipeline(jobId, context, PIPELINE_STEPS);
    console.log(`[Job ${jobId}] Pipeline complete. Generated ${finalCtx.processedClips?.length || 0} clips.`);
  } catch (error) {
    console.error(`[Job ${jobId}] Pipeline aborted: ${error.message}`);
  }
}

module.exports = { processVideo };
