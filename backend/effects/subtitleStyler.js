const fs = require('fs');
const { EMPHASIS_WORDS } = require('../ai/transcriptAnalyzer');

const STYLES = {
  default: {
    line: 'Style: Default,Arial,28,&H00FFFFFF,&H0000FFFF,&H00000000,&H99000000,0,0,0,0,100,100,0,0,1,3,1,2,60,60,150,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H0000FFFF&',
    fontSize: 34
  },
  hormozi: {
    line: 'Style: Default,Montserrat ExtraBold,38,&H00FFFFFF,&H0000FFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,4,1,2,46,46,170,1',
    upper: true,
    primary: '&H00FFFFFF&',
    accent: '&H0000E6FF&',
    fontSize: 42
  },
  mrbeast: {
    line: 'Style: Default,Arial Black,42,&H00FFFFFF,&H0000FFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,5,2,2,38,38,145,1',
    upper: true,
    primary: '&H00FFFFFF&',
    accent: '&H0000FFFF&',
    fontSize: 46
  },
  iman: {
    line: 'Style: Default,Inter SemiBold,34,&H00F6F1EA,&H00C8A15A,&H001A1714,&H88000000,1,0,0,0,100,100,0,0,1,3,1,2,58,58,160,1',
    upper: false,
    primary: '&H00F6F1EA&',
    accent: '&H00C8A15A&',
    fontSize: 38
  },
  gaming: {
    line: 'Style: Default,Arial Black,42,&H0000FFFF,&H00FFFFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,4,3,2,34,34,120,1',
    upper: true,
    primary: '&H0000FFFF&',
    accent: '&H000080FF&',
    fontSize: 46
  },
  podcast: {
    line: 'Style: Default,Inter SemiBold,30,&H00FFFFFF,&H0000FFFF,&H00000000,&H99000000,0,0,0,0,100,100,0,0,1,2,1,2,70,70,120,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H0000D7FF&',
    fontSize: 32
  },
  documentary: {
    line: 'Style: Default,Georgia,28,&H00F5F5F5,&H0000C8FF,&H00000000,&H99000000,0,0,0,0,100,100,0,0,1,2,1,2,78,78,115,1',
    upper: false,
    primary: '&H00F5F5F5&',
    accent: '&H0000C8FF&',
    fontSize: 30
  },
  cinematic: {
    line: 'Style: Default,Helvetica Neue,28,&H00FFFFFF,&H00C8C8C8,&H00000000,&H88000000,0,0,0,0,100,100,0,0,1,2,0,2,76,76,110,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H00D7D7D7&',
    fontSize: 30
  },
  minimalist: {
    line: 'Style: Default,Inter,26,&H00FFFFFF,&H00FFFFFF,&H00000000,&H66000000,0,0,0,0,100,100,0,0,1,1,0,2,88,88,95,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H00FFFFFF&',
    fontSize: 28
  }
};

function buildHeader(styleDef) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleDef.line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function toAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function parseSrtBlocks(srtContent) {
  return srtContent.trim().split(/\n\s*\n/).map(block => {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 3) return null;

    const match = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!match) return null;

    const start = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    const end = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
    const text = lines.slice(2).join(' ').replace(/\s+/g, ' ').trim();
    return { start, end, text };
  }).filter(Boolean);
}

function escapeAssText(text) {
  return text.replace(/[{}]/g, '').replace(/\\/g, '');
}

function isEmphasisWord(word) {
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  return EMPHASIS_WORDS.has(normalized) || /^\d+[kmb]?$/.test(normalized);
}

function buildKaraokeText(text, duration, styleDef) {
  const words = escapeAssText(styleDef.upper ? text.toUpperCase() : text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const centiseconds = Math.max(8, Math.floor((duration * 100) / words.length));
  return words.map((word, index) => {
    const isHot = isEmphasisWord(word);
    const color = isHot ? styleDef.accent : styleDef.primary;
    const size = isHot ? styleDef.fontSize + 8 : styleDef.fontSize;
    const pop = isHot ? '\\t(0,120,\\fscx116\\fscy116)\\t(120,260,\\fscx100\\fscy100)' : '\\t(0,110,\\fscx106\\fscy106)';
    const leadingBreak = index > 0 && index % 6 === 0 ? '\\N' : '';
    return `${leadingBreak}{\\k${centiseconds}\\c${color}\\fs${size}${pop}}${word}{\\r} `;
  }).join('').trim();
}

function convertToASS(srtContent, styleName = 'default') {
  const styleDef = STYLES[styleName] || STYLES.default;
  const blocks = parseSrtBlocks(srtContent);
  let assContent = buildHeader(styleDef);

  for (const block of blocks) {
    const duration = Math.max(0.4, block.end - block.start);
    const text = buildKaraokeText(block.text, duration, styleDef);
    if (!text) continue;
    assContent += `Dialogue: 0,${toAssTime(block.start)},${toAssTime(block.end)},Default,,0,0,0,,${text}\n`;
  }

  return assContent;
}

function generateStyledSubtitles(srtPath, outputPath, styleName = 'default') {
  if (!fs.existsSync(srtPath)) return null;
  const srtContent = fs.readFileSync(srtPath, 'utf-8');
  fs.writeFileSync(outputPath, convertToASS(srtContent, styleName), 'utf-8');
  return outputPath;
}

module.exports = {
  generateStyledSubtitles,
  convertToASS,
  STYLES
};
