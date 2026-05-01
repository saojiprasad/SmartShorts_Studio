import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Clip, JobStatus } from '../../services/api.service';

@Component({
  selector: 'app-clips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clips.html',
  styleUrl: './clips.scss'
})
export class Clips implements OnInit, OnDestroy {
  @Input() jobId: string = '';

  status = signal<JobStatus | null>(null);
  isPolling = signal(false);
  pollError = signal<string | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.jobId) {
      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  startPolling(): void {
    this.isPolling.set(true);
    this.pollStatus();

    // Poll every 2 seconds
    this.pollTimer = setInterval(() => {
      this.pollStatus();
    }, 2000);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling.set(false);
  }

  pollStatus(): void {
    this.api.getStatus(this.jobId).subscribe({
      next: (status) => {
        this.status.set(status);
        this.pollError.set(null);

        // Stop polling once completed or failed
        if (status.status === 'completed' || status.status === 'failed') {
          this.stopPolling();
        }
      },
      error: (err) => {
        this.pollError.set('Failed to fetch status. Retrying...');
        console.error('Poll error:', err);
      }
    });
  }

  getStreamUrl(clip: Clip): string {
    return this.api.getStreamUrl(clip);
  }

  getDownloadUrl(clip: Clip): string {
    return this.api.getDownloadUrl(this.jobId, clip.name);
  }

  downloadClip(clip: Clip): void {
    const url = this.getDownloadUrl(clip);
    const a = document.createElement('a');
    a.href = url;
    a.download = clip.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadAll(): void {
    const clips = this.status()?.clips || [];
    clips.forEach((clip, index) => {
      setTimeout(() => this.downloadClip(clip), index * 500);
    });
  }

  getStatusIcon(): string {
    const s = this.status()?.status;
    switch (s) {
      case 'processing': return 'sync';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      default: return 'hourglass_empty';
    }
  }

  getStatusLabel(): string {
    const s = this.status()?.status;
    switch (s) {
      case 'processing': return 'Processing...';
      case 'completed': return 'Complete!';
      case 'failed': return 'Failed';
      default: return 'Waiting...';
    }
  }

  formatDuration(seconds: string): string {
    const s = parseFloat(seconds);
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
}
