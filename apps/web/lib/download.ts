/** Trigger a browser save dialog for a blob without leaving the page. */
export function saveBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The download reads the blob asynchronously, so the URL has to outlive this tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
