'use strict';
/*
 * Ads layer — Google AdSense "H5 Games Ads" (Ad Placement API).
 *
 * ────────────────────────────────────────────────────────────────────
 *  HOW TO ENABLE REAL ADS (شرح كامل في README.md):
 *  1. Sign up at https://adsense.google.com and apply for
 *     "Ad Placement API / H5 Games Ads".
 *  2. Put your publisher id below (looks like ca-pub-1234567890123456).
 *  3. Optionally create a display ad unit for the bottom banner and put
 *     its slot id in `bannerSlot`.
 *  4. Set `testAds: false` before going live.
 *
 *  Until a real publisher id is set, the game shows SIMULATED ads so you
 *  can test the whole flow (interstitials + rewarded) locally.
 * ────────────────────────────────────────────────────────────────────
 */

const ADS_CONFIG = {
  adsenseClient: 'ca-pub-XXXXXXXXXXXXXXXX', // ← ضع معرّف الناشر الخاص بك هنا
  bannerSlot: '',                            // ← (اختياري) معرّف وحدة البانر
  testAds: true,                             // true أثناء التطوير فقط
};

const Ads = (function () {
  const configured = !/X{4,}/.test(ADS_CONFIG.adsenseClient);

  function init() {
    if (configured) {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS_CONFIG.adsenseClient;
      if (ADS_CONFIG.testAds) s.setAttribute('data-adbreak-test', 'on');
      document.head.appendChild(s);
      window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
    }
    setupBanner();
  }

  // ── Interstitial (between levels) ────────────────────────────────
  function interstitial(name, done) {
    const finish = () => { if (done) done(); };
    if (!configured) { simulateAd(false, finish); return; }
    window.adBreak({ type: 'next', name: name || 'level_complete', adBreakDone: finish });
  }

  // ── Rewarded ad. onResult(true) only if the ad was fully viewed. ──
  function rewarded(name, onResult) {
    if (!configured) { simulateAd(true, onResult); return; }
    let viewed = false;
    let shown = false;
    window.adBreak({
      type: 'reward',
      name: name || 'reward',
      beforeReward(showAdFn) { shown = true; showAdFn(); },
      adViewed() { viewed = true; },
      adDismissed() { viewed = false; },
      adBreakDone() {
        if (!shown && !viewed) {
          // No rewarded ad available right now — fall back to a simulated
          // one so the player is never blocked (remove if you prefer).
          simulateAd(true, onResult);
        } else {
          onResult(viewed);
        }
      },
    });
  }

  // ── Bottom banner ─────────────────────────────────────────────────
  function setupBanner() {
    const box = document.getElementById('banner-ad');
    if (!box) return;
    if (configured && ADS_CONFIG.bannerSlot) {
      box.innerHTML = '<ins class="adsbygoogle" style="display:block;width:100%;height:60px"' +
        ' data-ad-client="' + ADS_CONFIG.adsenseClient + '"' +
        ' data-ad-slot="' + ADS_CONFIG.bannerSlot + '"' +
        ' data-ad-format="horizontal" data-full-width-responsive="true"></ins>';
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } else {
      box.innerHTML = '<div class="banner-placeholder">' +
        (configured ? '' : 'مساحة إعلان بانر — Banner Ad (ضع معرّف AdSense في js/ads.js)') +
        '</div>';
    }
  }

  // ── Simulated ad overlay (used while no real publisher id is set) ──
  function simulateAd(isReward, cb) {
    const old = document.getElementById('sim-ad');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'sim-ad';
    wrap.innerHTML =
      '<div class="sim-ad-box">' +
      '  <div class="sim-ad-tag">إعلان تجريبي • Test Ad</div>' +
      '  <div class="sim-ad-art">📺</div>' +
      '  <div class="sim-ad-count"></div>' +
      '  <button class="sim-ad-btn" disabled></button>' +
      '</div>';
    document.body.appendChild(wrap);
    const btn = wrap.querySelector('.sim-ad-btn');
    const count = wrap.querySelector('.sim-ad-count');
    let left = isReward ? 5 : 3;
    btn.textContent = isReward ? '🎁 احصل على المكافأة' : 'متابعة';
    const tick = () => {
      if (left > 0) {
        count.textContent = left + '...';
        left--;
        setTimeout(tick, 1000);
      } else {
        count.textContent = '';
        btn.disabled = false;
      }
    };
    tick();
    btn.addEventListener('click', () => {
      wrap.remove();
      if (cb) cb(true);
    });
    if (isReward) {
      const close = document.createElement('button');
      close.className = 'sim-ad-close';
      close.textContent = '✕';
      wrap.querySelector('.sim-ad-box').appendChild(close);
      close.addEventListener('click', () => {
        wrap.remove();
        if (cb) cb(false);
      });
    }
  }

  return { init, interstitial, rewarded, configured };
})();
