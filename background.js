/* =============================================
   All Video Downloader — background.js
   Manifest V3 Service Worker
   ডাউনলোড ম্যানেজমেন্ট হ্যান্ডল করে
   ============================================= */

'use strict';

/* ══════════════════════════════════════════
   Popup থেকে মেসেজ শোনো
══════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  /* ── ভিডিও ডাউনলোড ── */
  if (message.action === 'downloadVideo') {
    const { url, filename } = message;

    if (!url || !filename) {
      sendResponse({ error: 'Missing URL or filename' });
      return true;
    }

    // Chrome Downloads API ব্যবহার করো
    chrome.downloads.download(
      {
        url:      url,
        filename: sanitizeFilename(filename),
        saveAs:   false, // সরাসরি ডাউনলোড ফোল্ডারে
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[AVD] Download error:', chrome.runtime.lastError.message);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          console.log('[AVD] Download started, ID:', downloadId);
          sendResponse({ success: true, downloadId });
        }
      }
    );

    return true; // async response-এর জন্য true রিটার্ন
  }

  /* ── কোনো অজানা মেসেজ ── */
  sendResponse({ error: 'Unknown action' });
  return true;
});

/* ══════════════════════════════════════════
   ডাউনলোড প্রোগ্রেস মনিটর (অপশনাল)
══════════════════════════════════════════ */
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === 'complete') {
    console.log('[AVD] Download complete, ID:', delta.id);
  }
  if (delta.state?.current === 'interrupted') {
    console.warn('[AVD] Download interrupted, ID:', delta.id);
  }
});

/* ══════════════════════════════════════════
   হেলপার: ফাইলনাম স্যানিটাইজ
══════════════════════════════════════════ */
function sanitizeFilename(name) {
  // ইনভ্যালিড ক্যারেক্টার সরাও, .mp4 এক্সটেনশন নিশ্চিত করো
  let clean = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .substring(0, 100);

  if (!clean.toLowerCase().endsWith('.mp4')) {
    clean += '.mp4';
  }

  return clean || 'video.mp4';
}

/* ══════════════════════════════════════════
   এক্সটেনশন ইনস্টল / আপডেট ইভেন্ট
══════════════════════════════════════════ */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AVD] All Video Downloader installed!');
  } else if (details.reason === 'update') {
    console.log('[AVD] Updated to version', chrome.runtime.getManifest().version);
  }
});

console.log('[AVD] Background service worker started.');
