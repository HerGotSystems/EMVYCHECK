(() => {
  'use strict';

  function addSiteLinks() {
    if (location.pathname !== '/' && location.pathname !== '/index.html') return;

    const menu = document.querySelector('.top-right');
    if (!menu || menu.querySelector('[data-emvy-site-link]')) return;

    const order = menu.querySelector('a[href="/order.html"]');
    const links = [
      { href: '/art/', label: 'Art', title: 'EMVY CHECK ART showcase' },
      { href: '/canvas-grid/', label: 'Grid', title: 'Open Canvas Grid Art Forge' }
    ];

    for (const item of links) {
      const link = document.createElement('a');
      link.className = 'top-btn';
      link.href = item.href;
      link.textContent = item.label;
      link.title = item.title;
      link.dataset.emvySiteLink = 'true';
      menu.insertBefore(link, order || null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSiteLinks, { once: true });
  } else {
    addSiteLinks();
  }
})();
