/**
 * Upload a file via XHR with real upload progress tracking.
 * Uses XMLHttpRequest instead of fetch() because fetch doesn't support
 * upload progress events.
 */

interface UploadResult {
  key: string;
  public_url: string;
}

export function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    // Cap at 90% during upload — the remaining 10% represents server-to-storage transfer
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 90);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      onProgress(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', '/api/upload/post-media');
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}
