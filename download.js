'use strict';

const scrapr = require('@coflyn/scrapr');

const METHODS = [
  { hosts: ['tiktok.com'], candidates: [() => scrapr.tiktok.snaptik, () => scrapr.tiktok.ssstik, () => scrapr.tiktok.tiktokio] },
  { hosts: ['instagram.com'], candidates: [() => scrapr.instagram.direct, () => scrapr.instagram.snapsave, () => scrapr.instagram.indown] },
  { hosts: ['youtube.com', 'youtu.be'], candidates: [() => scrapr.youtube.ytmp3gg, () => scrapr.youtube.ytmp3] },
  { hosts: ['x.com', 'twitter.com'], candidates: [() => scrapr.twitter.direct, () => scrapr.twitter.tweeload, () => scrapr.twitter.tvd] },
  { hosts: ['facebook.com', 'fb.watch'], candidates: [() => scrapr.facebook.snapsave, () => scrapr.facebook.fdown] },
  { hosts: ['pinterest.com', 'pin.it'], candidates: [() => scrapr.pinterest.direct, () => scrapr.pinterest.pindown] },
  { hosts: ['reddit.com', 'redd.it'], candidates: [() => scrapr.reddit.rapidsave] },
  { hosts: ['threads.net'], candidates: [() => scrapr.threads.threadster] },
  { hosts: ['soundcloud.com'], candidates: [() => scrapr.soundcloud.klickaud] },
  { hosts: ['pixiv.net'], candidates: [() => scrapr.pixiv.ajax] },
  { hosts: ['bilibili.com', 'b23.tv'], candidates: [() => scrapr.bilibili.direct] },
  { hosts: ['douyin.com'], candidates: [() => scrapr.douyin.direct] },
  { hosts: ['xiaohongshu.com', 'rednote.com'], candidates: [() => scrapr.rednote.direct] },
  { hosts: ['bandcamp.com'], candidates: [() => scrapr.bandcamp.bandcampdownloader] },
  { hosts: ['terabox.com'], candidates: [() => scrapr.terabox.sechno] },
];

function hostMatches(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

function findProvider(host) {
  return METHODS.find(group => group.hosts.some(domain => hostMatches(host, domain)));
}

function pickDownload(downloads, format) {
  if (!Array.isArray(downloads) || !downloads.length) return null;
  const wanted = format === 'mp3' ? ['audio', 'music'] : ['video'];
  const match = downloads.find(item => wanted.includes(String(item.type || '').toLowerCase()));
  return match || downloads[0];
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const rawUrl = String(body.url || '').trim();
    const format = body.format === 'mp3' ? 'mp3' : 'video';

    let parsed;
    try { parsed = new URL(rawUrl); } catch { return res.status(400).json({ error: 'ลิงก์ไม่ถูกต้อง' }); }
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'รองรับเฉพาะลิงก์ HTTPS' });
    }

    const provider = findProvider(parsed.hostname.toLowerCase());
    if (!provider) {
      return res.status(400).json({ error: 'ยังไม่รองรับเว็บไซต์นี้' });
    }

    let result = null;
    let lastError = null;
    for (const getMethod of provider.candidates) {
      let method;
      try { method = getMethod(); } catch { method = null; }
      if (typeof method !== 'function') continue;
      try {
        const response = await method(rawUrl);
        if (response && response.status && response.result) {
          result = response.result;
          break;
        }
        lastError = new Error((response && response.message) || 'ไม่พบข้อมูลสื่อ');
      } catch (error) {
        lastError = error;
      }
    }

    if (!result) {
      return res.status(502).json({
        error: (lastError && lastError.message) || 'ไม่สามารถวิเคราะห์ลิงก์ได้ในขณะนี้'
      });
    }

    const selected = pickDownload(result.downloads, format);
    if (!selected || !selected.url) {
      return res.status(404).json({ error: 'ไม่พบไฟล์รูปแบบที่ร้องขอจากแหล่งข้อมูล' });
    }

    return res.status(200).json({
      title: result.title || 'Media',
      thumbnail: result.thumbnail || '',
      download_url: selected.url,
      format: selected.type || format,
      quality: selected.quality || ''
    });
  } catch (error) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
}

module.exports = handler;
