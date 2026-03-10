/**
 * Frontend helper: sends a base64 image to /api/identify and logs the result.
 * @param {string} imageBase64 - Base64 image (raw or data URL, e.g. from FileReader.readAsDataURL)
 * @param {string} [mimeType] - Optional, e.g. 'image/jpeg'. Inferred from data URL if not set.
 * @returns {Promise<{object_detected:string, short_description:string, estimated_material:string}|null>}
 */
async function sendImageToAPI(imageBase64, mimeType) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    console.warn('sendImageToAPI: imageBase64 is required');
    return null;
  }
  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
  const mime = mimeType || (mimeMatch && mimeMatch[1]) || 'image/jpeg';
  try {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('identify API error:', res.status, data);
      return null;
    }
    console.log('identify result:', data);
    return data;
  } catch (err) {
    console.error('sendImageToAPI failed:', err);
    return null;
  }
}
