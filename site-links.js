(() => {
  'use strict';

  function addSiteLinks() {
    if (location.pathname !== '/' && location.pathname !== '/index.html') return;

    const menu = document.querySelector('.top-right');
    if (!menu || menu.querySelector('[data-emvy-site-link]')) return;

    const order = menu.querySelector('a[href="/order.html"]');
    const link = document.createElement('a');
    link.className = 'top-btn';
    link.href = '/art/';
    link.textContent = 'Art';
    link.title = 'EMVY CHECK ART showcase';
    link.dataset.emvySiteLink = 'true';
    menu.insertBefore(link, order || null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSiteLinks, { once: true });
  } else {
    addSiteLinks();
  }
})();
