const path = require('path');
const fs = require('fs');
const { runFFmpeg } = require('../utils/ffmpeg');

function safeDrawText(text = '') {
  return text
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .trim()
    .slice(0, 58);
}

function titleForThumbnail(clip, partNumber) {
  const title = clip.title || clip.hookText || `Part ${partNumber}`;
  return safeDrawText(title.toUpperCase());
}

async function extractPlainFrame(inputVideo, outputPath, seekTime) {
  await runFFmpeg([
    '-y',
    '-ss', String(seekTime),
    '-i', inputVideo,
    '-frames:v', '1',
    '-q:v', '2',
    outputPath
  ], 'Thumbnail fallback');
}

async function renderThumbnail(inputVideo, outputPath, width, height, text, seekTime) {
  const filter = [
    `scale='max(${width},a*${height})':'max(${height},${width}/a)'`,
    `crop=${width}:${height}:(in_w-${width})/2:(in_h-${height})/2`,
    'eq=contrast=1.16:saturation=1.18:brightness=0.015',
    'unsharp=5:5:0.55:3:3:0.25',
    `drawbox=x=0:y=ih*0.68:w=iw:h=ih*0.32:color=black@0.58:t=fill`,
    `drawtext=text='${text}':fontsize=${Math.round(width / 16)}:fontcolor=white:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h*0.74`
  ].join(',');

  await runFFmpeg([
    '-y',
    '-ss', String(seekTime),
    '-i', inputVideo,
    '-frames:v', '1',
    '-vf', filter,
    '-q:v', '2',
    outputPath
  ], 'Thumbnail');
}

async function generateThumbnailPack(inputVideo, outputDir, publicBasePath, clip, partNumber) {
  fs.mkdirSync(outputDir, { recursive: true });
  const seekTime = Math.max(0.4, Math.min((Number(clip.duration) || 10) * 0.22, 8));
  const text = titleForThumbnail(clip, partNumber);
  const variants = [
    { key: 'shortsCover', name: `Part_${String(partNumber).padStart(2, '0')}_shorts_cover.jpg`, w: 1080, h: 1920 },
    { key: 'youtubeThumbnail', name: `Part_${String(partNumber).padStart(2, '0')}_youtube_thumb.jpg`, w: 1280, h: 720 },
    { key: 'instagramCover', name: `Part_${String(partNumber).padStart(2, '0')}_instagram_cover.jpg`, w: 1080, h: 1350 }
  ];

  const result = {};
  for (const variant of variants) {
    const outputPath = path.join(outputDir, variant.name);
    try {
      await renderThumbnail(inputVideo, outputPath, variant.w, variant.h, text, seekTime);
    } catch (error) {
      console.warn(`  [Thumbnail] Styled thumbnail failed; saving clean frame. ${error.message}`);
      await extractPlainFrame(inputVideo, outputPath, seekTime);
    }

    result[variant.key] = `${publicBasePath}/${variant.name}`;
  }

  return result;
}

module.exports = {
  generateThumbnailPack
};
