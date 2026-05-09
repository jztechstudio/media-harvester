/* =============================================
   All Video Downloader — content.js v2
   Facebook Reel-সহ সব ভিডিও ধরে রাখে।
   XHR + Fetch দুটোই ইন্টারসেপ্ট করা হয়।
   ============================================= */

(function () {
  'use strict';

  if (window.__avd_injected) return;
  window.__avd_injected = true;

  window.__avd_videos = window.__avd_videos || new Map();
  const store = window.__avd_videos;

  function getSite() {
    const h = location.href;
    if (h.includes('youtube.com'))  return 'youtube';
    if (h.includes('facebook.com') || h.includes('fb.watch')) return 'facebook';
    if (h.includes('instagram.com')) return 'instagram';
    return 'unknown';
  }
  const site = getSite();

  /* ── Store ── */
  function storeVideo(src, meta) {
    if (!src || !src.startsWith('http')) return;
    if (store.has(src)) return;
    store.set(src, {
      url:       src,
      title:     (meta && meta.title) || document.title.replace(/ ?[|\-–] ?Facebook.*/, '').trim() || 'Facebook Video',
      thumbnail: (meta && meta.thumbnail) || '',
      quality:   (meta && meta.quality)   || 'SD',
      site,
    });
    console.log('[AVD] stored:', src.substring(0, 90));
  }

  /* ══ 1) HTML5 video ══ */
  function trackVideoEl(vid) {
    const check = () => {
      [vid.src, vid.currentSrc].forEach(s => s && storeVideo(s, { thumbnail: vid.poster }));
      vid.querySelectorAll('source').forEach(src => src.src && storeVideo(src.src, { thumbnail: vid.poster }));
    };
    check();
    ['loadstart','loadedmetadata','canplay','play','playing'].forEach(e => vid.addEventListener(e, check));
  }

  document.querySelectorAll('video').forEach(trackVideoEl);
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (!n || !n.querySelectorAll) return;
      if (n.tagName === 'VIDEO') trackVideoEl(n);
      n.querySelectorAll('video').forEach(trackVideoEl);
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ══ 2) Facebook text scan ══ */
  const FB_PATTERNS = [
    /"hd_src"\s*:\s*"([^"]+)"/g,
    /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/g,
    /"sd_src"\s*:\s*"([^"]+)"/g,
    /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/g,
    /"playable_url"\s*:\s*"([^"]+)"/g,
    /"playable_url_quality_hd"\s*:\s*"([^"]+)"/g,
    /"browser_native_sd_url"\s*:\s*"([^"]+)"/g,
    /"browser_native_hd_url"\s*:\s*"([^"]+)"/g,
    /videoUrl\s*:\s*["']([^"']+\.mp4[^"']*)["']/g,
  ];

  function scanText(text) {
    if (!text || text.length < 20) return;
    FB_PATTERNS.forEach(pat => {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(text)) !== null) {
        const raw = m[1]
          .replace(/\\u0026/g,'&').replace(/\\u0025/g,'%')
          .replace(/\\u003C/g,'<').replace(/\\u003E/g,'>')
          .replace(/\\\//g,'/').replace(/\\/g,'');
        if (raw.startsWith('http') && raw.includes('.mp4')) {
          const q = pat.source.includes('hd') ? 'HD' : 'SD';
          storeVideo(raw, { quality: q });
        }
      }
    });
  }

  /* ══ 3) Script ট্যাগ স্ক্যান ══ */
  if (site === 'facebook') {
    document.querySelectorAll('script').forEach(s => scanText(s.textContent));
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n && n.tagName === 'SCRIPT') scanText(n.textContent);
      }));
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ══ 4) XHR intercept ══ */
  if (site === 'facebook') {
    const OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
      const xhr = new OrigXHR();
      const origOpen = xhr.open.bind(xhr);
      const origSend = xhr.send.bind(xhr);
      xhr.open = function (method, url) {
        xhr._avdUrl = String(url || '');
        return origOpen.apply(xhr, arguments);
      };
      xhr.send = function () {
        xhr.addEventListener('readystatechange', function () {
          if (xhr.readyState === 4 && xhr.status === 200) {
            const u = xhr._avdUrl || '';
            if (u.includes('graphql') || u.includes('video') || u.includes('reel')) {
              try { scanText(xhr.responseText); } catch(e){}
            }
          }
        });
        return origSend.apply(xhr, arguments);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;

    /* ══ 5) Fetch intercept ══ */
    const origFetch = window.fetch;
    window.fetch = function () {
      const args = arguments;
      return origFetch.apply(this, args).then(function (res) {
        try {
          const u = (typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url)) || '';
          if (u.includes('graphql') || u.includes('video') || u.includes('reel')) {
            res.clone().text().then(scanText).catch(function(){});
          }
        } catch(e){}
        return res;
      });
    };
  }

  /* ══ 6) Message listener ══ */
  chrome.runtime.onMessage.addListener(function (msg, _sender, respond) {
    if (msg.action === 'getVideos') {
      respond({ videos: Array.from(store.values()), site: site });
      return true;
    }
    if (msg.action === 'ping') {
      respond({ ok: true });
      return true;
    }
  });

  console.log('[AVD] v2 ready:', site);
})();
