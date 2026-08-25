(() => {
  'use strict';

  function addSiteLinks() {
    const path = location.pathname;
    if (path !== '/music' && path !== '/music/' && path !== '/music/index.html') return;

    const menu = document.querySelector('.top-right');
    if (!menu || menu.querySelector('[data-emvy-site-link]')) return;

    const order = menu.querySelector('a[href="/order.html"]');

    const home = document.createElement('a');
    home.className = 'top-btn';
    home.href = '/';
    home.textContent = 'Home';
    home.title = 'EMVY CHECK home';
    home.dataset.emvySiteLink = 'true';

    const art = document.createElement('a');
    art.className = 'top-btn';
    art.href = '/art/';
    art.textContent = 'Art';
    art.title = 'EMVY CHECK ART showcase';
    art.dataset.emvySiteLink = 'true';

    menu.insertBefore(home, order || null);
    menu.insertBefore(art, order || null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSiteLinks, { once: true });
  } else {
    addSiteLinks();
  }
})();
