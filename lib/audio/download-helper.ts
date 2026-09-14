/**
 * Robust Cross-Browser Audio Downloader
 * Works across desktop Chrome, Firefox, Safari, Edge, and iOS/Android mobile browsers.
 */

export function downloadAudioBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    document.body.appendChild(a);
    a.click();

    // Clean up after slight delay to ensure browser initiates stream
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 2000);
  } catch (err) {
    console.error('Download error:', err);
    // Ultimate fallback: open in new window
    try {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      // ignore
    }
  }
}
