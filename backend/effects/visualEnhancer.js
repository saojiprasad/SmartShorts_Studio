function buildVisualEnhancementFilters(clip = {}) {
  const mood = clip.editPlan?.mood || 'high_retention';
  const energy = clip.details?.energyScore || 35;
  const sharpen = energy > 65 ? 'unsharp=5:5:0.72:3:3:0.30' : 'unsharp=5:5:0.55:3:3:0.24';
  const grade = {
    high_retention: 'eq=contrast=1.12:saturation=1.20:brightness=0.012',
    suspense: 'eq=contrast=1.15:saturation=0.94:brightness=-0.012,colorbalance=rs=0.03:bs=0.04',
    cinematic: 'eq=contrast=1.12:saturation=0.98:brightness=-0.006,colorbalance=rs=0.02:gs=-0.01:bs=0.03',
    premium: 'eq=contrast=1.10:saturation=1.02:brightness=0.004',
    funny: 'eq=contrast=1.10:saturation=1.24:brightness=0.015',
    aggressive: 'eq=contrast=1.15:saturation=1.28:brightness=0.008'
  }[mood] || 'eq=contrast=1.11:saturation=1.18:brightness=0.01';

  return [
    grade,
    sharpen,
    'hqdn3d=1.2:1.0:3.0:2.2',
    'vignette=angle=0.45'
  ];
}

module.exports = {
  buildVisualEnhancementFilters
};
