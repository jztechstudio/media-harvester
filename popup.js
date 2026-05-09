/* =============================================
   All Video Downloader — popup.js v2
   ১) content.js cache থেকে ভিডিও আনো
   ২) executeScript দিয়ে তাৎক্ষণিক স্ক্যান
   ৩) ম্যানুয়াল URL ডাউনলোড
   ============================================= */

/* ── DOM ── */
const scanBtn      = document.getElementById('scan-btn');
const scanLabel    = document.getElementById('scan-label');
const scanIcon     = document.querySelector('.scan-icon');
const statusBar    = document.getElementById('status-bar');
const statusText   = document.getElementById('status-text');
const videoList    = document.getElementById('video-list');
const siteBadge    = document.getElementById('site-badge');
const manualInput  = document.getElementById('manual-url');
const manualBtn    = document.getElementById('manual-btn');
const manualStatus = document.getElementById('manual-status');

/* ══ Status helpers ══ */
function setStatus(msg, type='info') {
  statusBar.className = `status-bar ${type}`;
  statusText.textContent = msg;
  statusBar.classList.remove('hidden');
}
function hideStatus() { statusBar.classList.add('hidden'); }

/* ══ Site detect ══ */
function detectSite(url) {
  if (!url) return 'unknown';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('facebook.com') || url.includes('fb.watch'))  return 'facebook';
  if (url.includes('instagram.com')) return 'instagram';
  return 'unknown';
}

function updateBadge(site) {
  const labels = { youtube:'▶ YouTube', facebook:'f Facebook', instagram:'◉ Instagram', unknown:'? Unknown' };
  siteBadge.textContent = labels[site] || '? Unknown';
  siteBadge.className = `site-badge ${site}`;
}

/* ══ Escape HTML ══ */
function esc(s) {
  return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
}

/* ══ Sanitize filename ══ */
function saneName(n) {
  return (n || 'video').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim().substring(0,80) || 'video';
}

/* ══════════════════════════════════════════
   ভিডিও কার্ড রেন্ডার
══════════════════════════════════════════ */
function renderCard(video, idx) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.style.animationDelay = `${idx * 0.05}s`;

  const thumbHtml = video.thumbnail
    ? `<img src="${esc(video.thumbnail)}" alt="" onerror="this.parentElement.innerHTML='<div class=video-thumb-placeholder>🎥</div>'">`
    : `<div class="video-thumb-placeholder">🎥</div>`;

  const q = (video.quality || '').toUpperCase();
  const qBadge = q
    ? `<div class="video-quality-badge ${q==='SD'?'sd':''}">${q}</div>`
    : '';

  const srcClass  = `source-${video.site || 'unknown'}`;
  const srcLabel  = {youtube:'YouTube', facebook:'Facebook', instagram:'Instagram'}[video.site] || 'Video';

  card.innerHTML = `
    <div class="video-thumb-wrap">
      ${thumbHtml}
      ${qBadge}
    </div>
    <div class="video-info">
      <div class="video-title">${esc(video.title || 'Video')}</div>
      <div class="video-meta">
        <span class="video-source ${srcClass}">${srcLabel}</span>
        <span style="font-size:10px;color:var(--text-secondary)">MP4</span>
      </div>
      <button class="download-btn">⬇ Download MP4</button>
    </div>`;

  card.querySelector('.download-btn').addEventListener('click', function() {
    triggerDownload(this, video);
  });
  return card;
}

/* ══════════════════════════════════════════
   ডাউনলোড ট্রিগার
══════════════════════════════════════════ */
async function triggerDownload(btn, video) {
  if (btn.classList.contains('downloading') || btn.classList.contains('done')) return;
  btn.classList.add('downloading');
  btn.textContent = '⟳ Downloading...';
  setStatus('Download started…', 'info');

  const filename = saneName(video.title) + '.mp4';

  chrome.runtime.sendMessage({ action: 'downloadVideo', url: video.url, filename }, (res) => {
    if (chrome.runtime.lastError || (res && res.error)) {
      // fallback: anchor click
      anchorDl(video.url, filename);
    }
    btn.classList.remove('downloading');
    btn.classList.add('done');
    btn.textContent = '✓ Done!';
    setStatus('Download started!', 'success');
    setTimeout(() => {
      btn.classList.remove('done');
      btn.textContent = '⬇ Download MP4';
      hideStatus();
    }, 3000);
  });
}

function anchorDl(url, filename) {
  const a = Object.assign(document.createElement('a'), { href: url, download: filename, target: '_blank' });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ══════════════════════════════════════════
   ম্যানুয়াল URL ডাউনলোড
══════════════════════════════════════════ */
function showManualStatus(msg, type) {
  manualStatus.textContent = msg;
  manualStatus.className = `manual-status ${type}`;
  manualStatus.classList.remove('hidden');
}
function hideManualStatus() { manualStatus.classList.add('hidden'); }

manualBtn.addEventListener('click', () => doManualDownload());
manualInput.addEventListener('keydown', e => { if (e.key === 'Enter') doManualDownload(); });

async function doManualDownload() {
  const url = manualInput.value.trim();
  if (!url) {
    showManualStatus('⚠ Please paste a video URL first.', 'error');
    return;
  }
  if (!url.startsWith('http')) {
    showManualStatus('⚠ URL must start with http:// or https://', 'error');
    return;
  }

  manualBtn.classList.add('busy');
  manualBtn.textContent = '⟳';
  showManualStatus('⏳ Starting download…', 'info');

  // টাইটেল হিসেবে URL এর শেষ অংশ ব্যবহার করো
  const guessName = url.split('/').pop().split('?')[0].replace(/\.mp4.*/, '') || 'video';
  const filename  = saneName(guessName) + '.mp4';

  chrome.runtime.sendMessage({ action: 'downloadVideo', url, filename }, (res) => {
    manualBtn.classList.remove('busy');
    manualBtn.textContent = '⬇';

    if (chrome.runtime.lastError || (res && res.error)) {
      // fallback
      anchorDl(url, filename);
      showManualStatus('✓ Download triggered! Check your downloads folder.', 'ok');
    } else {
      showManualStatus('✓ Download started! Check your downloads folder.', 'ok');
    }

    manualBtn.classList.add('ok');
    setTimeout(() => {
      manualBtn.classList.remove('ok');
      manualBtn.textContent = '⬇';
      hideManualStatus();
    }, 4000);
  });
}

/* ══════════════════════════════════════════
   স্ক্যান: content.js cache + executeScript
   দুটো মিলিয়ে ভিডিও দেখাও
══════════════════════════════════════════ */
scanBtn.addEventListener('click', async () => {
  if (scanBtn.classList.contains('scanning')) return;

  scanBtn.classList.add('scanning');
  scanLabel.textContent = 'Scanning…';
  setStatus('Scanning page for videos…', 'info');
  videoList.innerHTML = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    /* ── পদ্ধতি ১: content.js-এর cache থেকে আনো ── */
    let cachedVideos = [];
    try {
      cachedVideos = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'getVideos' }, (res) => {
          if (chrome.runtime.lastError || !res) { resolve([]); return; }
          resolve(res.videos || []);
        });
      });
    } catch(e) { cachedVideos = []; }

    /* ── পদ্ধতি ২: executeScript দিয়ে সরাসরি DOM স্ক্যান ── */
    let domVideos = [];
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageNow,
      });
      domVideos = results?.[0]?.result || [];
    } catch(e) { domVideos = []; }

    /* ── মার্জ করো (URL দিয়ে deduplicate) ── */
    const seen = new Set();
    const allVideos = [];
    [...cachedVideos, ...domVideos].forEach(v => {
      if (!v || !v.url || seen.has(v.url)) return;
      seen.add(v.url);
      allVideos.push(v);
    });

    // HD প্রথমে দেখাও
    allVideos.sort((a,b) => {
      const aHD = (a.quality||'').toUpperCase() === 'HD';
      const bHD = (b.quality||'').toUpperCase() === 'HD';
      return aHD === bHD ? 0 : aHD ? -1 : 1;
    });

    scanBtn.classList.remove('scanning');
    scanLabel.textContent = 'Scan for Videos';

    if (allVideos.length === 0) {
      showNoVideo(tab.url);
      return;
    }

    setStatus(`Found ${allVideos.length} video${allVideos.length > 1 ? 's' : ''}`, 'success');
    allVideos.forEach((v, i) => videoList.appendChild(renderCard(v, i)));

  } catch (err) {
    console.error('[AVD] scan error:', err);
    scanBtn.classList.remove('scanning');
    scanLabel.textContent = 'Scan for Videos';
    setStatus('Scan failed. Try reloading the page.', 'error');
    videoList.innerHTML = `<div class="no-video-state"><div class="icon">⚠️</div><p>${esc(err.message)}</p></div>`;
  }
});

/* ══════════════════════════════════════════
   executeScript পেলোড: পেজের DOM ও script স্ক্যান
   (এই ফাংশন page context-এ রান হয়)
══════════════════════════════════════════ */
function scanPageNow() {
  const seen = new Set();
  const videos = [];
  const href   = location.href;

  let site = 'unknown';
  if (href.includes('youtube.com'))  site = 'youtube';
  else if (href.includes('facebook.com') || href.includes('fb.watch')) site = 'facebook';
  else if (href.includes('instagram.com')) site = 'instagram';

  /* ── 1) window.__avd_videos (content.js cache) ── */
  if (window.__avd_videos && window.__avd_videos.size > 0) {
    window.__avd_videos.forEach((v, url) => {
      if (!seen.has(url)) { seen.add(url); videos.push(v); }
    });
  }

  /* ── 2) <video> ট্যাগ ── */
  document.querySelectorAll('video').forEach(function(vid) {
    [vid.src, vid.currentSrc].concat(
      Array.from(vid.querySelectorAll('source')).map(function(s){ return s.src; })
    ).forEach(function(src) {
      if (!src || !src.startsWith('http') || seen.has(src)) return;
      seen.add(src);
      videos.push({
        url: src,
        title: vid.getAttribute('aria-label') || document.title.replace(/ ?[|\-–] ?Facebook.*/,'').trim() || 'Video',
        thumbnail: vid.poster || '',
        quality: 'SD',
        site: site,
      });
    });
  });

  /* ── 3) Facebook script scan ── */
  if (site === 'facebook') {
    var FB_PATS = [
      /"hd_src"\s*:\s*"([^"]+)"/g,
      /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/g,
      /"sd_src"\s*:\s*"([^"]+)"/g,
      /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/g,
      /"playable_url"\s*:\s*"([^"]+)"/g,
      /"playable_url_quality_hd"\s*:\s*"([^"]+)"/g,
      /"browser_native_sd_url"\s*:\s*"([^"]+)"/g,
      /"browser_native_hd_url"\s*:\s*"([^"]+)"/g,
    ];

    document.querySelectorAll('script').forEach(function(script) {
      var txt = script.textContent;
      if (!txt || txt.length < 20 || txt.length > 600000) return;
      FB_PATS.forEach(function(pat) {
        pat.lastIndex = 0;
        var m;
        while ((m = pat.exec(txt)) !== null) {
          var raw = m[1]
            .replace(/\\u0026/g,'&').replace(/\\u0025/g,'%')
            .replace(/\\u003C/g,'<').replace(/\\u003E/g,'>')
            .replace(/\\\//g,'/').replace(/\\/g,'');
          if (raw.startsWith('http') && raw.includes('.mp4') && !seen.has(raw)) {
            seen.add(raw);
            var q = pat.source.includes('hd') ? 'HD' : 'SD';
            videos.push({
              url: raw,
              title: document.title.replace(/ ?[|\-–] ?Facebook.*/,'').trim() || 'Facebook Video',
              thumbnail: '',
              quality: q,
              site: 'facebook',
            });
          }
        }
      });
    });
  }

  /* ── 4) Instagram OG meta ── */
  if (site === 'instagram') {
    var ogV = document.querySelector('meta[property="og:video"]');
    if (ogV && ogV.content && !seen.has(ogV.content)) {
      seen.add(ogV.content);
      videos.push({
        url: ogV.content,
        title: (document.querySelector('meta[property="og:title"]') || {}).content || 'Instagram Video',
        thumbnail: (document.querySelector('meta[property="og:image"]') || {}).content || '',
        quality: 'SD',
        site: 'instagram',
      });
    }
  }

  /* ── 5) YouTube ── */
  if (site === 'youtube') {
    var ytV = document.querySelector('#movie_player video, .html5-video-player video');
    if (ytV) {
      var src = ytV.src || ytV.currentSrc;
      if (src && !seen.has(src)) {
        seen.add(src);
        var idM = location.href.match(/v=([a-zA-Z0-9_-]{11})/);
        var thumb = idM ? 'https://img.youtube.com/vi/'+idM[1]+'/hqdefault.jpg' : '';
        videos.push({
          url: src,
          title: document.title.replace(' - YouTube','').trim(),
          thumbnail: thumb,
          quality: 'SD',
          site: 'youtube',
        });
      }
    }
  }

  return videos;
}

/* ══════════════════════════════════════════
   ভিডিও না পেলে
══════════════════════════════════════════ */
function showNoVideo(pageUrl) {
  hideStatus();
  const site = detectSite(pageUrl || '');

  let tip = '';
  if (site === 'facebook') {
    tip = `<p class="tip">
      💡 <strong>Tips for Facebook Reels:</strong><br/>
      1. Reel-টি play করুন<br/>
      2. ২-৩ সেকেন্ড অপেক্ষা করুন<br/>
      3. তারপর Scan করুন<br/>
      4. না হলে — নিচে URL পেস্ট করে ডাউনলোড করুন
    </p>`;
  } else if (site === 'youtube') {
    tip = `<div class="yt-notice">⚠️ YouTube DRM-encrypted streams ব্যবহার করে। Direct browser download সম্ভব নয়।<br/>yt-dlp ব্যবহার করুন।</div>`;
  } else if (site === 'instagram') {
    tip = `<p class="tip">💡 Instagram post/reel পেজে সরাসরি যান, তারপর scan করুন।</p>`;
  } else {
    tip = `<p class="tip">💡 Facebook, YouTube বা Instagram-এ কোনো ভিডিও পেজে যান।</p>`;
  }

  videoList.innerHTML = `
    <div class="no-video-state">
      <div class="icon">🔍</div>
      <p>No videos found on this page.</p>
      ${tip}
    </div>`;
}

/* ══════════════════════════════════════════
   Init: সাইট ব্যাজ
══════════════════════════════════════════ */
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) updateBadge(detectSite(tab.url));
  } catch(e) {}
})();
