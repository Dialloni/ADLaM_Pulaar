// Images the user wants EMBEDDED in a generated app.
// Downscaled in the browser before anything leaves the device (bandwidth +
// Storage cost), uploaded to the existing collector/{uid} path (owner-write
// rules already allow images there), embedded via tokenized download URLs.
import { storage, ref, uploadBytes, getDownloadURL } from '../firebase';

/** Per-build cap — each image adds ~1–1.6k vision tokens; more is waste. */
export const MAX_APP_IMAGES = 6;

/**
 * Resize an image dataURL so its longest side is ≤ maxDim, re-encoded as
 * JPEG (or PNG if the source was PNG — keeps logo transparency). A phone
 * photo (4000px, 3–8MB) becomes ~200–400KB with no visible difference at
 * web sizes. GIFs pass through untouched (canvas would kill the animation).
 */
export async function downscaleDataUrl(dataUrl: string, maxDim = 1600): Promise<string> {
  if (dataUrl.startsWith('data:image/gif')) return dataUrl;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  // already small enough (dimensions AND weight) — keep the original bytes
  if (scale === 1 && dataUrl.length < 700_000) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const isPng = dataUrl.startsWith('data:image/png');
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85);
}

/** Upload images for embedding; resolves to {name, url} per image (parallel). */
export async function uploadAppImages(
  uid: string,
  images: { name: string; dataUrl: string }[],
): Promise<{ name: string; url: string }[]> {
  const stamp = Date.now();
  return Promise.all(images.map(async (im, i) => {
    const blob = await (await fetch(im.dataUrl)).blob();
    const safe = im.name.replace(/[^\w.-]+/g, '_').slice(-60) || `image-${i}.jpg`;
    const r = ref(storage, `collector/${uid}/app-${stamp}-${i}-${safe}`);
    await uploadBytes(r, blob);
    return { name: im.name, url: await getDownloadURL(r) };
  }));
}

/** Prompt block instructing the model to embed the uploaded images. */
export function embedImagesPrompt(uploaded: { name: string; url: string }[]): string {
  return (
    `\n\nUSER IMAGES — the user uploaded these photos to appear IN the app. ` +
    `Embed EVERY one with an <img> tag using the EXACT URL given (copy it ` +
    `character-for-character; never shorten, re-host or invent URLs). Place ` +
    `each where it best fits the content (the images were also provided ` +
    `visually so you know what they show). Make them responsive ` +
    `(max-width:100%; height:auto or object-fit:cover) with meaningful alt text:\n` +
    uploaded.map(u => `- ${u.name}: ${u.url}`).join('\n')
  );
}
