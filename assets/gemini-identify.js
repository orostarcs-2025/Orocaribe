/**
 * Shopify theme: send image to Vercel API for Gemini Vision object identification.
 * Usage: sendImageToAPI('https://YOUR_VERCEL_DOMAIN', fileInputElementOrFile)
 * Set default URL in Liquid: window.GEMINI_IDENTIFY_API_URL = 'https://your-app.vercel.app';
 */

(function () {
  'use strict';

  /**
   * Convert a File to base64 string (raw, no data URL prefix).
   * @param {File} file
   * @returns {Promise<string>}
   */
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Not an image file'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        var base64 = dataUrl.indexOf('base64,') !== -1 ? dataUrl.split('base64,')[1] : dataUrl;
        resolve(base64);
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Send image to Vercel API for identification.
   * @param {string} apiBaseUrl - Base URL of your Vercel app (e.g. 'https://your-app.vercel.app'). No trailing slash.
   * @param {HTMLInputElement|File} imageInputOrFile - File input element (type="file") or a File object.
   * @returns {Promise<{object_detected: string, estimated_material: string, short_description: string}|null>} Description object or null on error.
   */
  window.sendImageToAPI = function (apiBaseUrl, imageInputOrFile) {
    var file = null;
    if (imageInputOrFile instanceof File) {
      file = imageInputOrFile;
    } else if (imageInputOrFile && typeof imageInputOrFile.files !== 'undefined' && imageInputOrFile.files[0]) {
      file = imageInputOrFile.files[0];
    }
    if (!file) {
      console.warn('sendImageToAPI: provide a file input element or a File object');
      return Promise.resolve(null);
    }

    var url = (apiBaseUrl || window.GEMINI_IDENTIFY_API_URL || '').replace(/\/$/, '') + '/api/identify';
    if (!url || url === '/api/identify') {
      console.warn('sendImageToAPI: set apiBaseUrl or window.GEMINI_IDENTIFY_API_URL to your Vercel domain');
      return Promise.resolve(null);
    }

    return fileToBase64(file).then(function (base64) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          console.error('identify API error:', res.status, data);
          return null;
        }
        console.log('identify result:', data);
        return data;
      });
    }).catch(function (err) {
      console.error('sendImageToAPI failed:', err);
      return null;
    });
  };
})();
