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
const { generateStyledSubtitles, generateFallbackSubtitles } = require('../effects/subtitleStyler');
const { renderFinalClip } = require('../effects/finalRenderer');
const { generateThumbnailPack } = require('../effects/thumbnailGenerator');
const { updateJob } = require('./jobStore');
const { transcribeWithPythonAi } = require('./pythonAiClient');

const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './outputs');

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

function dedupeClipsForRender(clips, maxClips = 20) {
  const selected = [];
  const sorted = [...clips].sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));

  for (const clip of sorted) {
    const duplicate = selected.some(existing => {
      const overlap = Math.max(0, Math.min(existing.end, clip.end) - Math.max(existing.start, clip.start));
      const smallerDuration = Math.max(1, Math.min(existing.duration, clip.duration));
      const centerDistance = Math.abs(((existing.start + existing.end) / 2) - ((clip.start + clip.end) / 2));
      return overlap / smallerDuration > 0.12 || centerDistance < 15;
    });

    if (!duplicate) selected.push(clip);
    if (selected.length >= maxClips) break;
  }

  return selected.sort((a, b) => a.start - b.start);
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
      const needsTranscript = true;
      if (!needsTranscript) {
        progress(100);
        return { fullSrt: null, whisperAvailable: false };
      }

      progress(10);
      const model = process.env.WHISPER_MODEL || 'large-v3';
      const pythonSrt = await transcribeWithPythonAi(ctx.originalFile, ctx.segmentsDir, model);
      if (pythonSrt) {
        progress(100);
        return { fullSrt: pythonSrt, whisperAvailable: true };
      }

      const whisperAvailable = await isWhisperAvailable();
      if (!whisperAvailable) {
        progress(100);
        return { fullSrt: null, whisperAvailable: false };
      }

      const fullSrt = await generateSubtitles(ctx.originalFile, ctx.segmentsDir, model);
      progress(100);
      return { fullSrt, whisperAvailable };
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

      clipsToProcess = dedupeClipsForRender(clipsToProcess, 20);

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
        const finalPath = path.join(ctx.jobOutputDir, `${partPrefix}.mp4`);
        const finalOutputName = `${partPrefix}.mp4`;

        const editPlan = createEditPlan(clip, mode);
        const seo = clip.seo || buildSeoPackage(clip, mode);
        const enrichedClip = { ...clip, editPlan, seo, title: seo.title, description: seo.description, hashtags: seo.hashtags };

        let subtitlePath = path.join(ctx.segmentsDir, `${partPrefix}_forced.ass`);
        if (ctx.whisperAvailable) {
          const clipModel = process.env.WHISPER_CLIP_MODEL || process.env.WHISPER_MODEL || 'large-v3';
          const segSrt = await generateSubtitles(clip.path, ctx.segmentsDir, clipModel);
          if (segSrt) {
            subtitlePath = generateStyledSubtitles(segSrt, subtitlePath, ctx.options.subtitleStyle || 'hormozi') || subtitlePath;
          }
        }

        if (!subtitlePath || !fs.existsSync(subtitlePath)) {
          subtitlePath = generateFallbackSubtitles(
            path.join(ctx.segmentsDir, `${partPrefix}_fallback.ass`),
            enrichedClip,
            ctx.options.subtitleStyle || 'hormozi'
          );
        }

        try {
          await renderFinalClip({
            inputPath: clip.path,
            outputPath: finalPath,
            subtitlePath,
            partNumber,
            clip: enrichedClip,
            options: {
              ...ctx.options,
              addSubtitles: true,
              enableEffects: true
            },
            metadata: ctx.metadata
          });
        } catch (error) {
          console.warn(`[FinalRender] Full edit render failed for part ${partNumber}; rendering safe captioned fallback. ${error.message}`);
          try {
            await processSegment(
              clip.path,
              finalPath,
              partNumber,
              subtitlePath,
              ctx.options.aspectRatio,
              ctx.options.cropMode
            );
          } catch (fallbackError) {
            console.warn(`[FinalRender] Captioned fallback failed for part ${partNumber}; copying source segment. ${fallbackError.message}`);
            fs.copyFileSync(clip.path, finalPath);
          }
        }

        const publicBasePath = `/outputs/${ctx.jobId}`;
        let thumbnailPack = {};
        try {
          thumbnailPack = await generateThumbnailPack(finalPath, ctx.jobOutputDir, publicBasePath, enrichedClip, partNumber);
          thumbnails.push(thumbnailPack);
        } catch (error) {
          console.warn(`[Thumbnail] Thumbnail generation skipped for part ${partNumber}: ${error.message}`);
        }

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
