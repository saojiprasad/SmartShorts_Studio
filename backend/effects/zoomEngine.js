const { RESOLUTION_MAP } = require('../utils/ffmpeg');

function even(value) {
  return Math.ceil(value / 2) * 2;
}

function buildZoomAndCropFilters({ aspectRatio = '9:16', cropMode = 'smart_crop', faceFocus = null, clip = {} }) {
  const { w, h } = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];
  const energy = clip.details?.energyScore || 35;
  const retention = clip.details?.retentionScore || 35;
  const zoomMultiplier = energy > 65 ? 1.16 : retention > 65 ? 1.13 : 1.10;
  const zoomW = even(w * zoomMultiplier);
  const zoomH = even(h * zoomMultiplier);
  const shakeX = Math.max(4, Math.round(w * (energy > 65 ? 0.016 : 0.009)));
  const shakeY = Math.max(4, Math.round(h * (energy > 65 ? 0.010 : 0.006)));

  let xExpression = `(in_w-${w})/2`;
  if (cropMode === 'smart_crop' && faceFocus) {
    const xRatio = Number(faceFocus.xRatio.toFixed(4));
    xExpression = `max(0,min(in_w-${w},${xRatio}*in_w-${w}/2))`;
  }

  const yExpression = `(in_h-${h})/2`;
  const punchPulse = "lt(mod(t\\,3.0)\\,0.16)";
  const slowDrift = `sin(t*0.55)*${Math.max(2, Math.round(w * 0.006))}`;
  const moveX = `${xExpression}+${slowDrift}+sin(t*9)*${shakeX}*${punchPulse}`;
  const moveY = `${yExpression}+cos(t*7)*${shakeY}*${punchPulse}`;

  return [
    `scale='trunc(max(${zoomW},a*${zoomH})/2)*2':'trunc(max(${zoomH},${zoomW}/a)/2)*2'`,
    `crop=${w}:${h}:x='max(0,min(in_w-${w},${moveX}))':y='max(0,min(in_h-${h},${moveY}))'`
  ];
}

module.exports = {
  buildZoomAndCropFilters
};
