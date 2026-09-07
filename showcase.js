/* EMVY CHECK — HOMEPAGE SHOWCASE v0.1
   Prepares the real artwork showcase structure so real images can be
   dropped in later without redesigning the site (see
   docs/SHOWCASE-UPLOAD-GUIDE-v0.1.md and
   docs/EMVYCHECK-MEDIA-SHOWCASE-ARCHITECTURE-V1.md).

   To add real artwork: put web-size derivatives in /showcase/ and fill
   in the "image" field below. An empty "image" field is skipped
   entirely — no broken image box, no stock placeholder, nothing shown
   for that slot until a real file exists. */
(function () {
  'use strict';

  var SHOWCASE_ITEMS = [
    { image: 'showcase-01-hero.jpg', caption: 'EMVY CHECK ART — layered single artwork' },
    { image: 'showcase-02-grid9.jpg', caption: 'Canvas Grid — 3×3 continuous panel study' },
    { image: '', caption: 'Canvas Grid — multi-panel presentation' },
    { image: 'showcase-04-calm.jpg', caption: 'Canvas Grid — calm linework, interior-friendly direction' },
    { image: 'showcase-05-emvy.jpg', caption: 'Canvas Grid — loud, high-colour EMVY direction' },
    { image: 'showcase-06-variation-a.jpg', caption: 'Canvas Grid — related design variation, colour state 1 of 3' },
    { image: 'showcase-06-variation-b.jpg', caption: 'Canvas Grid — related design variation, colour state 2 of 3' },
    { image: 'showcase-06-variation-c.jpg', caption: 'Canvas Grid — related design variation, colour state 3 of 3' }
  ];

  function install() {
    var grid = document.getElementById('showcase-grid');
    if (!grid) return;

    var real = SHOWCASE_ITEMS.filter(function (item) { return item.image; });

    if (!real.length) {
      var note = document.createElement('p');
      note.className = 'showcase-note';
      note.textContent = 'Real Canvas Grid / EMVY CHECK artwork examples are being added here.';
      grid.appendChild(note);
      return;
    }

    real.forEach(function (item, i) {
      var card = document.createElement('figure');
      card.className = 'showcase-card';
      var img = document.createElement('img');
      img.src = '/showcase/' + item.image;
      img.alt = item.caption;
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      var cap = document.createElement('figcaption');
      cap.textContent = item.caption;
      card.appendChild(img);
      card.appendChild(cap);
      grid.appendChild(card);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
