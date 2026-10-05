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
  var playRetryTimer = null;
  var resumeTimer = null;
  var lastRecoverAt = 0;
  var waitingSince = 0;
  var recoveryTimer = null;
  var lastGoodTime = 0;

  au.preload = 'metadata';
  au.setAttribute('preload', 'metadata');
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
    waitingSince = 0;
  });

  au.addEventListener('pause', function () {
    clearTimeout(resumeTimer);
    if (!shouldAutoResume()) {
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

  function recoverStream(reason, forceReload) {
    if (!shouldAutoResume()) return;
    if (Date.now() - lastRecoverAt < 1800) return;
    lastRecoverAt = Date.now();
    clearTimeout(recoveryTimer);

    var pos = Math.max(lastGoodTime || 0, au.currentTime || 0);
    var src = au.currentSrc || au.src;
    if (!src) return;

    function replayWhenReady() {
      try {
        if (pos > 0 && au.duration && pos < au.duration - 1) au.currentTime = pos;
      } catch (e) {}
      safePlay(reason, 0);
    }

    if (forceReload || au.error || au.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      try {
        au.pause();
        au.removeAttribute('src');
        au.load();
        au.src = src;
        au.load();
      } catch (e) {}
      au.addEventListener('canplay', function handler() {
        au.removeEventListener('canplay', handler);
        replayWhenReady();
      });
      recoveryTimer = setTimeout(replayWhenReady, 2200);
      return;
    }

    safePlay(reason, 0);
    recoveryTimer = setTimeout(function () {
      if (shouldAutoResume() && au.paused) recoverStream(reason + '-reload', true);
    }, 2200);
  }

  au.addEventListener('waiting', function () {
    if (!shouldAutoResume()) return;
    if (!waitingSince) waitingSince = Date.now();
    clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(function () {
      if (shouldAutoResume() && au.paused === false && waitingSince && Date.now() - waitingSince >= 2500) {
        recoverStream('buffering', true);
      }
    }, 2700);
  });
  au.addEventListener('playing', function () { waitingSince = 0; clearTimeout(recoveryTimer); });
  au.addEventListener('canplay', function () {
    waitingSince = 0;
    if (shouldAutoResume() && au.paused) safePlay('canplay', 0);
  });
  au.addEventListener('stalled', function () { recoverStream('stalled', true); });
  au.addEventListener('error', function () { recoverStream('media-error', true); });
  au.addEventListener('suspend', function () {
    if (navigator.onLine && shouldAutoResume() && au.paused) safePlay('suspend', 0);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && shouldAutoResume()) {
      safePlay('visible-again', 0);
    }
  });

  window.addEventListener('online', function () {
    if (!shouldAutoResume()) return;
    recoverStream('online', au.paused || au.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
  });

  window.addEventListener('offline', function () {
    clearTimeout(recoveryTimer);
  });

  window.addEventListener('beforeunload', function () {
    clearTimeout(recoveryTimer);
    clearTimeout(playRetryTimer);
    clearTimeout(resumeTimer);
  });
})();
