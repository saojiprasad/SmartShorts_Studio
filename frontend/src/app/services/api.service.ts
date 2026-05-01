/**
 * API Service — Handles all HTTP communication with the backend.
 *
 * Provides methods for uploading videos, starting processing,
 * polling status, and retrieving clips.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadResponse {
  jobId: string;
  filename: string;
  size: string;
  status: string;
  message: string;
}

export interface ProcessResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface Clip {
  name: string;
  partNumber: number;
  path: string;
  size: string;
  sizeBytes: number;
  duration: string;
}

export interface JobStatus {
  jobId: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalClips: number;
  processedClips: number;
  clips: Clip[];
  error: string | null;
}

export interface ClipsResponse {
  jobId: string;
  status: string;
  totalClips: number;
  clips: Clip[];
}

const API_BASE = 'http://localhost:3000/api';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) {}

  /**
   * Upload a video file with progress tracking.
   * Returns an Observable of HttpEvents so we can track upload progress.
   */
  uploadVideo(file: File): Observable<HttpEvent<UploadResponse>> {
    const formData = new FormData();
    formData.append('video', file);

    const req = new HttpRequest('POST', `${API_BASE}/upload`, formData, {
      reportProgress: true,
    });

    return this.http.request<UploadResponse>(req);
  }

  /**
   * Start processing a previously uploaded video.
   */
  startProcessing(jobId: string, clipDuration: number = 90, addSubtitles: boolean = false, aspectRatio: string = '9:16'): Observable<ProcessResponse> {
    return this.http.post<ProcessResponse>(`${API_BASE}/process`, {
      jobId,
      clipDuration,
      addSubtitles,
      aspectRatio
    });
  }

  /**
   * Get the current status of a job.
   */
  getStatus(jobId: string): Observable<JobStatus> {
    return this.http.get<JobStatus>(`${API_BASE}/status/${jobId}`);
  }

  /**
   * Get the list of clips for a completed job.
   */
  getClips(jobId: string): Observable<ClipsResponse> {
    return this.http.get<ClipsResponse>(`${API_BASE}/clips/${jobId}`);
  }

  /**
   * Get the download URL for a specific clip.
   */
  getDownloadUrl(jobId: string, clipName: string): string {
    return `${API_BASE}/download/${jobId}/${clipName}`;
  }

  /**
   * Get the streaming URL for a clip (served as static file).
   */
  getStreamUrl(clip: Clip): string {
    return `http://localhost:3000${clip.path}`;
  }
}
