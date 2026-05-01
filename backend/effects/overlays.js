const { runFFmpeg } = require('../utils/ffmpeg');

/**
 * Overlay Service
 * Generates dynamic TikTok-style overlays like progress bars, watermark texts, etc.
 */

async function applyProgressOverlay(inputVideo, outputPath, durationStr) {
  // TikTok-style progress bar at the bottom
  // drawbox: x=0:y=ih-10:w=iw*t/DURATION:h=10:color=red@0.8:t=fill
  const duration = Math.max(0.1, parseFloat(durationStr) || 0.1);
  const filterGraph = `drawbox=x=0:y=ih-8:w='iw*(t/${duration})':h=8:color=0xff3333@0.9:t=fill`;

  const args = [
    '-y',
    '-i', inputVideo,
    '-vf', filterGraph,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    outputPath
  ];

  await runFFmpeg(args, 'Progress Overlay');
  return outputPath;
}

module.exports = {
  applyProgressOverlay
};
