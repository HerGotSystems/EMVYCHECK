(() => {
  'use strict';

  const grid = document.getElementById('instant-products-grid');
  const status = document.getElementById('instant-products-status');
  if (!grid) return;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function productCard(product) {
    const title = esc(product.title || 'EMVY CHECK product');
    const subtitle = esc(product.subtitle || 'Digital product');
    const price = esc(product.priceLabel || 'See product page');
    const image = esc(product.image || '/showcase/showcase-01-hero.jpg');
    const alt = esc(product.imageAlt || title);
    const url = esc(product.checkoutUrl || '#');
    const button = esc(product.buttonLabel || 'VIEW / BUY');
    const collection = esc((product.collection || 'art').replace(/-/g, ' '));

    return `
      <article class="product shop-live-product" data-product-id="${esc(product.id)}" data-collection="${collection}">
        <img src="${image}" alt="${alt}" loading="lazy" decoding="async">
        <div class="body">
          <div class="tag">${collection}</div>
          <h3>${title}</h3>
          <div class="price">${price}</div>
          <p>${subtitle}</p>
          <p class="small">Checkout currently handled by ${esc(product.checkoutProvider || 'external provider')} while EMVY CHECK builds its native checkout layer.</p>
          <div class="actions"><a class="btn hot" href="${url}" target="_blank" rel="noopener noreferrer">${button} →</a></div>
        </div>
      </article>`;
  }

  fetch('/shop/catalogue.json', { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error('catalogue unavailable');
      return r.json();
    })
    .then(data => {
      const products = Array.isArray(data.products)
        ? data.products.filter(p => p && p.status === 'live' && p.checkoutUrl)
        : [];

      if (!products.length) throw new Error('no live products');
      grid.innerHTML = products.map(productCard).join('');
      if (status) status.textContent = products.length + ' live product' + (products.length === 1 ? '' : 's');
    })
    .catch(() => {
      if (status) status.textContent = 'Product catalogue temporarily unavailable';
    });
})();