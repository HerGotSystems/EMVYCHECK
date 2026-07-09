/*
  EMVY CHECK — car audio hardening layer
  Purpose: make the web player less fragile in car/Bluetooth/navigation use.
  This script is injected by service-worker.js so index.html can stay untouched.
*/
(function () {
  if (window.__emvyCarAudioHardening) return;
  window.__emvyCarAudioHardening = true;

  var au = document.getElementById('au');
  if (!au) return;

  var userWantsPlay = false;
  var manualPauseAt = 0;
  var wakeLock = null;
  var playRetryTimer = null;
  var resumeTimer = null;
  var lastRecoverAt = 0;

  au.preload = 'auto';
  au.setAttribute('preload', 'auto');
  au.setAttribute('playsinline', '');
  au.setAttribute('webkit-playsinline', '');

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function resumeAudioContext() {
    try {
      if (typeof window.iA === 'function') window.iA();
      if (window.aCtx && window.aCtx.state === 'suspended') window.aCtx.resume();
    } catch (e) {}
  }

  function rememberPlayIntent() {
    userWantsPlay = true;
    tryWakeLock();
  }

  function rememberManualPause() {
    manualPauseAt = Date.now();
    userWantsPlay = false;
  }

  function shouldAutoResume() {
    if (!userWantsPlay) return false;
    if (!au.src) return false;
    if (au.ended) return false;
    if (Date.now() - manualPauseAt < 1500) return false;
    return true;
  }

  function safePlay(reason, attempt) {
    attempt = attempt || 0;
    clearTimeout(playRetryTimer);
    if (!shouldAutoResume()) return;
    resumeAudioContext();
    au.play().then(function () {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    }).catch(function () {
      if (!shouldAutoResume()) return;
      if (attempt < 5) {
        var delays = [350, 800, 1600, 3000, 5000];
        playRetryTimer = setTimeout(function () { safePlay(reason, attempt + 1); }, delays[attempt]);
      } else {
        toast('Playback blocked — tap play once');
      }
    });
  }

  function tryWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    if (!userWantsPlay) return;
    if (wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      wakeLock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {});
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    wakeLock.release().catch(function () {}).finally(function () { wakeLock = null; });
  }

  function playNextFromCurrent() {
    if (!window.ALBUMS || !window.ALBUMS.length || window.cT === -1) return false;
    var ai = window.cA;
    var ti = window.cT + 1;
    if (!window.ALBUMS[ai] || !window.ALBUMS[ai].tracks) return false;
    if (ti >= window.ALBUMS[ai].tracks.length) {
      ai = (ai + 1) % window.ALBUMS.length;
      ti = 0;
    }
    if (typeof window.pT === 'function') {
      window.plMode = false;
      window.pT(ai, ti);
      return true;
    }
    return false;
  }

  function patchFunction(name, wrapperFactory) {
    if (typeof window[name] !== 'function') return null;
    var original = window[name];
    window[name] = wrapperFactory(original);
    return original;
  }

  var originalNextTrack = patchFunction('nextTrack', function (original) {
    return function hardenedNextTrack() {
      rememberPlayIntent();
      var wasPlaylistMode = !!window.plMode;
      var beforeSrc = au.currentSrc || au.src;
      original.apply(this, arguments);
      setTimeout(function () {
        var afterSrc = au.currentSrc || au.src;
        if (wasPlaylistMode && !window.plMode && au.paused && beforeSrc === afterSrc) {
          if (playNextFromCurrent()) return;
        }
        if (shouldAutoResume()) safePlay('next-track', 0);
      }, 180);
    };
  });

  patchFunction('pT', function (original) {
    return function hardenedPlayTrack() {
      rememberPlayIntent();
      original.apply(this, arguments);
      safePlay('track-select', 0);
    };
  });

  patchFunction('playFromPlaylist', function (original) {
    return function hardenedPlaylistPlay() {
      rememberPlayIntent();
      original.apply(this, arguments);
      safePlay('playlist-select', 0);
    };
  });

  patchFunction('carPlayPause', function (original) {
    return function hardenedCarPlayPause() {
      if (au.paused) rememberPlayIntent();
      else rememberManualPause();
      original.apply(this, arguments);
      if (userWantsPlay) safePlay('car-play', 0);
    };
  });

  if (originalNextTrack) {
    var nextBtn = document.getElementById('btnNext');
    if (nextBtn) {
      nextBtn.removeEventListener('click', originalNextTrack);
      nextBtn.addEventListener('click', window.nextTrack);
    }
  }

  var playBtn = document.getElementById('btnPlay');
  if (playBtn) playBtn.addEventListener('click', function () {
    rememberPlayIntent();
    setTimeout(function () { safePlay('main-play', 0); }, 0);
  }, true);

  var pauseBtn = document.getElementById('btnPause');
  if (pauseBtn) pauseBtn.addEventListener('click', rememberManualPause, true);

  var carPlayBtn = document.getElementById('carPlayBtn');
  if (carPlayBtn) carPlayBtn.addEventListener('click', function () {
    if (au.paused) rememberPlayIntent();
    else rememberManualPause();
  }, true);

  var originalSetMediaSession = window.setMediaSession;
  if (typeof originalSetMediaSession === 'function') {
    window.setMediaSession = function hardenedMediaSession(albumName, trackTitle) {
      originalSetMediaSession.apply(this, arguments);
      if (!('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.setActionHandler('play', function () {
          rememberPlayIntent();
          safePlay('media-session-play', 0);
        });
        navigator.mediaSession.setActionHandler('pause', function () {
          rememberManualPause();
          au.pause();
        });
        navigator.mediaSession.setActionHandler('nexttrack', function () {
          if (typeof window.nextTrack === 'function') window.nextTrack();
        });
        navigator.mediaSession.setActionHandler('previoustrack', function () {
          var prev = document.getElementById('btnPrev');
          if (prev) prev.click();
        });
        navigator.mediaSession.setActionHandler('seekbackward', function () {
          if (au.duration) au.currentTime = Math.max(0, au.currentTime - 15);
        });
        navigator.mediaSession.setActionHandler('seekforward', function () {
          if (au.duration) au.currentTime = Math.min(au.duration - 1, au.currentTime + 15);
        });
      } catch (e) {}
    };
  }

  au.addEventListener('play', function () {
    rememberPlayIntent();
    tryWakeLock();
  });

  au.addEventListener('pause', function () {
    clearTimeout(resumeTimer);
    if (!shouldAutoResume()) {
      if (!userWantsPlay) releaseWakeLock();
      return;
    }
    resumeTimer = setTimeout(function () {
      if (shouldAutoResume()) safePlay('unexpected-pause', 0);
    }, 1200);
  });

  au.addEventListener('ended', function () {
    if (!userWantsPlay) return;
    setTimeout(function () {
      if (au.paused && userWantsPlay) safePlay('ended-recovery', 0);
    }, 500);
  });

  function recoverStream(reason) {
    if (!shouldAutoResume()) return;
    if (Date.now() - lastRecoverAt < 2500) return;
    lastRecoverAt = Date.now();
    var pos = au.currentTime || 0;
    try { au.load(); } catch (e) {}
    au.addEventListener('canplay', function handler() {
      au.removeEventListener('canplay', handler);
      try { if (pos && au.duration && pos < au.duration - 2) au.currentTime = pos; } catch (e) {}
      safePlay(reason, 0);
    });
    setTimeout(function () { safePlay(reason, 0); }, 1600);
  }

  au.addEventListener('stalled', function () { recoverStream('stalled'); });
  au.addEventListener('error', function () { recoverStream('media-error'); });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      tryWakeLock();
      if (shouldAutoResume()) safePlay('visible-again', 0);
    } else {
      releaseWakeLock();
    }
  });

  window.addEventListener('online', function () { if (shouldAutoResume()) safePlay('online', 0); });

  window.addEventListener('beforeunload', function () {
    releaseWakeLock();
  });
})();
