function buildTransitionFilters(clip = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const resetEvery = Math.max(2.2, Math.min(4.0, clip.editPlan?.pacing?.cutEverySeconds || 3.1));

  return [
    `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.08:t=fill:enable='lt(mod(t\\,${resetEvery.toFixed(2)})\\,0.07)'`,
    `drawbox=x=0:y=ih-10:w='iw*(t/${duration})':h=10:color=0xffd400@0.95:t=fill`
  ];
}

module.exports = {
  buildTransitionFilters
};
