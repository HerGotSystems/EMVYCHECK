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

  // Titles come from the original artwork filenames (see
  // showcase/README-MAPPING.txt). "context" is the format / Canvas
  // context; "alt" describes what is actually visible.
  var SHOWCASE_ITEMS = [
    { image: 'showcase-01-hero.jpg', title: 'Frost Bloom', context: 'Canvas Grid · single artwork', alt: 'Frost Bloom — layered single Canvas Grid artwork by EMVY CHECK' },
    { image: 'showcase-02-grid9.jpg', title: 'Desert Threads', context: 'Canvas Grid · continuous 3×3 panel piece', alt: 'Desert Threads — one continuous composition across a 3×3 panel grid' },
    { image: 'showcase-03-multipanel.jpg', title: 'Bubbles', context: 'Canvas Grid · 8×8, 64-panel presentation preview', alt: 'Bubbles — 64-panel Canvas Grid presentation preview' },
    { image: 'showcase-04-calm.jpg', title: 'Gentle Drift', context: 'Canvas Grid · calm linework, interior-friendly direction', alt: 'Gentle Drift — calm cream and neutral linework' },
    { image: 'showcase-05-emvy.jpg', title: 'Coastal Spires', context: 'Canvas Grid · loud, layered, high-colour EMVY direction', alt: 'Coastal Spires — loud, jagged, high-colour layered composition' },
    { image: 'showcase-06-variation-a.jpg', title: 'Marble Pulse · A', context: 'Canvas Grid · one composition, colour state 1 of 3', alt: 'Marble Pulse, colour state A' },
    { image: 'showcase-06-variation-b.jpg', title: 'Marble Pulse · B', context: 'Canvas Grid · one composition, colour state 2 of 3', alt: 'Marble Pulse, colour state B' },
    { image: 'showcase-06-variation-c.jpg', title: 'Marble Pulse · C', context: 'Canvas Grid · one composition, colour state 3 of 3', alt: 'Marble Pulse, colour state C' }
  ];

  // Enquiry line only — not a claim that a print or licence is in stock.
  var ENQUIRY = { text: 'Print, space or licensing enquiry →', href: '/contact.html?topic=custom' };

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
      img.alt = item.alt || item.title;
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      var cap = document.createElement('figcaption');
      var title = document.createElement('strong');
      title.className = 'showcase-title';
      title.textContent = item.title;
      var context = document.createElement('span');
      context.className = 'showcase-context';
      context.textContent = item.context;
      var enquire = document.createElement('a');
      enquire.className = 'showcase-enquire';
      enquire.href = ENQUIRY.href;
      enquire.textContent = ENQUIRY.text;
      cap.appendChild(title);
      cap.appendChild(context);
      cap.appendChild(enquire);
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
