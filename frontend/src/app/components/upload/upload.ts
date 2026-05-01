import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload {
  @Output() jobStarted = new EventEmitter<string>();

  // State signals
  isDragOver = signal(false);
  selectedFile = signal<File | null>(null);
  uploadProgress = signal(0);
  isUploading = signal(false);
  isProcessing = signal(false);
  uploadComplete = signal(false);
  errorMessage = signal<string | null>(null);

  // Options
  clipDuration = signal(90);
  addSubtitles = signal(false);
  aspectRatio = signal('9:16');

  // Duration presets
  durationPresets = [
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '60s', value: 60 },
    { label: '90s', value: 90 },
    { label: '120s', value: 120 },
    { label: '180s', value: 180 },
  ];

  // Aspect ratio presets
  aspectPresets = [
    { label: '9:16', value: '9:16', desc: 'Shorts / Reels', icon: 'crop_portrait', res: '1080×1920' },
    { label: '16:9', value: '16:9', desc: 'YouTube / Landscape', icon: 'crop_landscape', res: '1920×1080' },
    { label: '1:1', value: '1:1', desc: 'Square / Instagram', icon: 'crop_square', res: '1080×1080' },
    { label: '4:5', value: '4:5', desc: 'Instagram Feed', icon: 'crop_din', res: '1080×1350' },
  ];

  constructor(private api: ApiService) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    // Validate file type — accept all common video formats
    const allowedExts = ['.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm','.mpeg','.mpg','.3gp','.m4v','.ts','.mts','.vob','.ogv'];
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (!file.type.startsWith('video/') && !allowedExts.includes(ext)) {
      this.errorMessage.set('Please upload a video file (MP4, MKV, AVI, MOV, WebM, etc.).');
      return;
    }

    // Validate file size (5 GB max)
    const maxSize = 5 * 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      this.errorMessage.set('File is too large. Maximum size is 5 GB.');
      return;
    }

    this.errorMessage.set(null);
    this.selectedFile.set(file);
    this.uploadComplete.set(false);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.uploadProgress.set(0);
    this.uploadComplete.set(false);
    this.errorMessage.set(null);
  }

  setDuration(value: number): void {
    this.clipDuration.set(value);
  }

  toggleSubtitles(): void {
    this.addSubtitles.set(!this.addSubtitles());
  }

  setAspectRatio(value: string): void {
    this.aspectRatio.set(value);
  }

  startUpload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.errorMessage.set(null);

    this.api.uploadVideo(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total
            ? Math.round((100 * event.loaded) / event.total)
            : 0;
          this.uploadProgress.set(progress);
        } else if (event.type === HttpEventType.Response) {
          const body = event.body;
          if (body) {
            this.isUploading.set(false);
            this.uploadComplete.set(true);
            this.uploadProgress.set(100);

            // Auto-start processing
            this.startProcessing(body.jobId);
          }
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err.error?.message || 'Upload failed. Please try again.');
        console.error('Upload error:', err);
      }
    });
  }

  private startProcessing(jobId: string): void {
    this.isProcessing.set(true);

    this.api.startProcessing(jobId, this.clipDuration(), this.addSubtitles(), this.aspectRatio()).subscribe({
      next: () => {
        this.isProcessing.set(false);
        this.jobStarted.emit(jobId);
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to start processing.');
        console.error('Process error:', err);
      }
    });
  }
}
