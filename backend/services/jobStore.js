/**
 * Job Store — In-memory state management for video processing jobs
 *
 * Each job tracks:
 *  - status:          'uploaded' | 'processing' | 'completed' | 'failed'
 *  - progress:        0–100 percentage
 *  - totalClips:      total number of segments detected
 *  - processedClips:  how many segments have been fully processed
 *  - clips:           array of { name, path, partNumber, size, duration }
 *  - error:           error message if status === 'failed'
 *  - originalFile:    path to the uploaded file
 *  - options:         { clipDuration, addSubtitles }
 */

const jobs = new Map();

const JobStatus = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Create a new job entry.
 */
function createJob(jobId, originalFile) {
  const job = {
    jobId,
    status: JobStatus.UPLOADED,
    progress: 0,
    totalClips: 0,
    processedClips: 0,
    clips: [],
    error: null,
    originalFile,
    options: {},
    createdAt: new Date().toISOString()
  };
  jobs.set(jobId, job);
  return job;
}

/**
 * Get a job by ID. Returns null if not found.
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Update fields on an existing job.
 */
function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

/**
 * Get all jobs (for listing/debugging).
 */
function getAllJobs() {
  return Array.from(jobs.values());
}

module.exports = {
  JobStatus,
  createJob,
  getJob,
  updateJob,
  getAllJobs
};
