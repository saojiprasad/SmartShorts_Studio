require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const apiRoutes = require('./routes/api');
const sseRoutes = require('./routes/sse');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './outputs');

[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

app.use(cors());
app.use(express.json());
app.use('/outputs', express.static(OUTPUT_DIR));
app.use('/api', apiRoutes);
app.use('/api/events', sseRoutes.router);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    name: 'SmartShorts Studio',
    uploadDir: UPLOAD_DIR,
    outputDir: OUTPUT_DIR
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: `Maximum file size is ${process.env.MAX_FILE_SIZE_MB || 5000}MB`
    });
  }

  if (err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only video files are accepted (MP4, MKV, AVI, MOV, WebM, etc.)'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('\nSmartShorts Studio - Backend');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Uploads dir: ${UPLOAD_DIR}`);
  console.log(`Outputs dir: ${OUTPUT_DIR}\n`);
});
