/* EMVY CHECK — QUICK GUIDE / LANGUAGE HELP v0.1
   Lightweight, static, no-account, no-external-service orientation panel.
   Content source of truth: docs/EMVY-QUICK-GUIDE-TRANSLATIONS-v0.1.md
   English remains the authoritative language for legal/commercial terms —
   these translations are for orientation and product use only. */
(function () {
  'use strict';

  var LANGS = {
    en: {
      name: 'English',
      whatTitle: 'What is EMVY CHECK?',
      what: 'EMVY CHECK is a creative system for making, commissioning, producing and licensing visual artwork. You can experiment in Canvas Grid yourself, ask us to make artwork for you, or contact us about commercial and production use.',
      startTitle: 'Start here',
      start: [
        ['MAKE', 'Open Canvas Grid and experiment.'],
        ['BUY', 'Ask EMVY CHECK to create artwork for you.'],
        ['COMMERCIAL', 'Ask about printing, selling, manufacturing or business use.'],
        ['PARTNERS', 'Work with EMVY CHECK on a real project.'],
        ['HELP', 'Contact us if you are unsure what you need.']
      ],
      basicsTitle: 'Canvas Grid basics',
      basics: [
        ['Motif', 'choose the starting visual structure.'],
        ['Format', 'choose the panel or layout shape.'],
        ['Composition', 'use one motif or combine structures.'],
        ['Look', 'change the visual treatment.'],
        ['Colour', 'try different colour directions.'],
        ['Seed', 'create related variations of the same idea.'],
        ['Preview', 'see how the work may look in panels or a room.'],
        ['Save Recipe', 'save the lightweight rebuild file — it keeps your setup so you can reopen and reproduce compatible work later, instead of storing every giant production image. Export the large production file only when you actually need it.'],
        ['Advanced', 'use deeper controls only when you want them.']
      ],
      important: 'Important: A Preview is not a production file. A saved Recipe is not a commercial licence.',
      paidTitle: 'Paid orders',
      paid: 'Paid orders currently happen by conversation. Tell us what you need, we confirm the scope, price and usage rights, you approve the order, payment is handled by invoice or another agreed business payment method, and we deliver the agreed final files and written usage rights.'
    },
    cs: {
      name: 'Čeština',
      whatTitle: 'Co je EMVY CHECK?',
      what: 'EMVY CHECK je kreativní systém pro tvorbu, zakázkovou výrobu, produkci a licencování vizuálního umění. V Canvas Grid můžete sami experimentovat, můžete nás požádat o vytvoření díla na zakázku nebo nás kontaktovat ohledně komerčního využití a výroby.',
      startTitle: 'Začněte zde',
      start: [
        ['TVORBA', 'Otevřete Canvas Grid a experimentujte.'],
        ['OBJEDNAT', 'Požádejte EMVY CHECK o vytvoření díla pro vás.'],
        ['KOMERČNÍ VYUŽITÍ', 'Zeptejte se na tisk, prodej, výrobu nebo použití pro podnikání.'],
        ['PARTNEŘI', 'Spolupracujte s EMVY CHECK na skutečném projektu.'],
        ['POMOC', 'Kontaktujte nás, pokud si nejste jistí, co potřebujete.']
      ],
      basicsTitle: 'Základy Canvas Grid',
      basics: [
        ['Motiv', 'vyberte výchozí vizuální strukturu.'],
        ['Formát', 'vyberte tvar panelu nebo rozvržení.'],
        ['Kompozice', 'použijte jeden motiv nebo kombinujte více struktur.'],
        ['Vzhled', 'změňte vizuální zpracování.'],
        ['Barva', 'vyzkoušejte různé barevné směry.'],
        ['Seed', 'vytvářejte příbuzné varianty stejného nápadu.'],
        ['Náhled', 'podívejte se, jak může dílo vypadat jako panely nebo v místnosti.'],
        ['Uložit recept', 'uložte odlehčený soubor pro opětovné sestavení — uchová vaše nastavení, abyste mohli později znovu otevřít a reprodukovat kompatibilní dílo, místo ukládání každého obřího produkčního obrázku. Velký produkční soubor exportujte, jen když ho skutečně potřebujete.'],
        ['Pokročilé', 'hlubší ovládání použijte jen tehdy, když ho chcete.']
      ],
      important: 'Důležité: Náhled není produkční soubor. Uložený recept není komerční licence.',
      paidTitle: 'Placené objednávky',
      paid: 'Placené objednávky nyní probíhají domluvou. Řeknete nám, co potřebujete, my potvrdíme rozsah, cenu a práva k použití, vy objednávku schválíte, platba proběhne na základě faktury nebo jiným dohodnutým obchodním způsobem a my dodáme dohodnuté finální soubory a písemná práva k použití.'
    },
    hr: {
      name: 'Hrvatski',
      whatTitle: 'Što je EMVY CHECK?',
      what: 'EMVY CHECK je kreativni sustav za izradu, naručivanje, produkciju i licenciranje vizualne umjetnosti. Možete sami eksperimentirati u Canvas Gridu, naručiti od nas umjetnički rad ili nas kontaktirati u vezi komercijalne upotrebe i produkcije.',
      startTitle: 'Počnite ovdje',
      start: [
        ['IZRADI', 'Otvorite Canvas Grid i eksperimentirajte.'],
        ['NARUČI', 'Zamolite EMVY CHECK da izradi umjetnički rad za vas.'],
        ['KOMERCIJALNO', 'Pitajte o tisku, prodaji, proizvodnji ili poslovnoj upotrebi.'],
        ['PARTNERI', 'Radite s EMVY CHECKOM na stvarnom projektu.'],
        ['POMOĆ', 'Kontaktirajte nas ako niste sigurni što vam treba.']
      ],
      basicsTitle: 'Osnove Canvas Grida',
      basics: [
        ['Motiv', 'odaberite početnu vizualnu strukturu.'],
        ['Format', 'odaberite oblik panela ili raspored.'],
        ['Kompozicija', 'koristite jedan motiv ili kombinirajte strukture.'],
        ['Izgled', 'promijenite vizualni tretman.'],
        ['Boja', 'isprobajte različite smjerove boja.'],
        ['Seed', 'stvarajte povezane varijacije iste ideje.'],
        ['Pregled', 'pogledajte kako rad može izgledati kao panel ili u prostoru.'],
        ['Spremi recept', 'spremite laganu datoteku za ponovnu izradu — čuva vaše postavke kako biste kasnije mogli ponovno otvoriti i reproducirati kompatibilan rad, umjesto spremanja svake goleme produkcijske slike. Veliku produkcijsku datoteku izvezite tek kad je stvarno trebate.'],
        ['Napredno', 'koristite detaljnije kontrole samo kada ih želite.']
      ],
      important: 'Važno: Pregled nije produkcijska datoteka. Spremljeni recept nije komercijalna licenca.',
      paidTitle: 'Plaćene narudžbe',
      paid: 'Plaćene narudžbe trenutačno se dogovaraju izravno. Kažete nam što vam treba, mi potvrđujemo opseg, cijenu i prava korištenja, vi odobravate narudžbu, plaćanje se obavlja putem računa ili drugog dogovorenog poslovnog načina plaćanja, a mi dostavljamo dogovorene završne datoteke i pisana prava korištenja.'
    },
    de: {
      name: 'Deutsch',
      whatTitle: 'Was ist EMVY CHECK?',
      what: 'EMVY CHECK ist ein Kreativsystem zum Erstellen, Beauftragen, Produzieren und Lizenzieren visueller Kunst. Sie können selbst in Canvas Grid experimentieren, uns mit einem Kunstwerk beauftragen oder uns wegen kommerzieller Nutzung und Produktion kontaktieren.',
      startTitle: 'Hier starten',
      start: [
        ['ERSTELLEN', 'Canvas Grid öffnen und experimentieren.'],
        ['KAUFEN / BEAUFTRAGEN', 'EMVY CHECK mit einem Kunstwerk beauftragen.'],
        ['KOMMERZIELL', 'Fragen zu Druck, Verkauf, Herstellung oder geschäftlicher Nutzung stellen.'],
        ['PARTNER', 'Mit EMVY CHECK an einem echten Projekt arbeiten.'],
        ['HILFE', 'Kontaktieren Sie uns, wenn Sie nicht sicher sind, was Sie brauchen.']
      ],
      basicsTitle: 'Canvas-Grid-Grundlagen',
      basics: [
        ['Motiv', 'die visuelle Ausgangsstruktur wählen.'],
        ['Format', 'Panel- oder Layoutform wählen.'],
        ['Komposition', 'ein Motiv verwenden oder Strukturen kombinieren.'],
        ['Look', 'die visuelle Behandlung ändern.'],
        ['Farbe', 'verschiedene Farbrichtungen ausprobieren.'],
        ['Seed', 'verwandte Varianten derselben Idee erzeugen.'],
        ['Vorschau', 'sehen, wie das Werk als Paneele oder in einem Raum wirken kann.'],
        ['Rezept speichern', 'speichern Sie die leichte Wiederaufbau-Datei — sie bewahrt Ihre Einstellung, damit Sie kompatible Arbeit später wieder öffnen und reproduzieren können, statt jedes riesige Produktionsbild zu speichern. Exportieren Sie die große Produktionsdatei erst, wenn Sie sie wirklich brauchen.'],
        ['Erweitert', 'detailliertere Steuerelemente nur bei Bedarf verwenden.']
      ],
      important: 'Wichtig: Eine Vorschau ist keine Produktionsdatei. Ein gespeichertes Rezept ist keine kommerzielle Lizenz.',
      paidTitle: 'Bezahlte Aufträge',
      paid: 'Bezahlte Aufträge werden derzeit direkt vereinbart. Sie teilen uns mit, was Sie benötigen, wir bestätigen Umfang, Preis und Nutzungsrechte, Sie genehmigen den Auftrag, die Zahlung erfolgt per Rechnung oder über eine andere vereinbarte geschäftliche Zahlungsmethode, und wir liefern die vereinbarten finalen Dateien sowie die schriftlichen Nutzungsrechte.'
    },
    fr: {
      name: 'Français',
      whatTitle: "Qu'est-ce qu'EMVY CHECK ?",
      what: "EMVY CHECK est un système créatif pour créer, commander, produire et licencier des œuvres visuelles. Vous pouvez expérimenter vous-même dans Canvas Grid, nous demander de créer une œuvre pour vous ou nous contacter pour une utilisation commerciale ou une production physique.",
      startTitle: 'Commencez ici',
      start: [
        ['CRÉER', 'Ouvrez Canvas Grid et expérimentez.'],
        ['COMMANDER', 'Demandez à EMVY CHECK de créer une œuvre pour vous.'],
        ['COMMERCIAL', "Posez vos questions sur l'impression, la vente, la fabrication ou l'utilisation professionnelle."],
        ['PARTENAIRES', 'Travaillez avec EMVY CHECK sur un projet réel.'],
        ['AIDE', 'Contactez-nous si vous ne savez pas exactement ce dont vous avez besoin.']
      ],
      basicsTitle: 'Les bases de Canvas Grid',
      basics: [
        ['Motif', 'choisissez la structure visuelle de départ.'],
        ['Format', 'choisissez la forme du panneau ou de la mise en page.'],
        ['Composition', 'utilisez un motif ou combinez plusieurs structures.'],
        ['Look', 'modifiez le traitement visuel.'],
        ['Couleur', 'essayez différentes directions de couleurs.'],
        ['Seed', 'créez des variations liées à la même idée.'],
        ['Aperçu', "voyez comment l'œuvre peut apparaître en panneaux ou dans une pièce."],
        ['Enregistrer la recette', "enregistrez le fichier léger de reconstruction — il conserve votre configuration pour que vous puissiez rouvrir et reproduire un travail compatible plus tard, au lieu de stocker chaque immense image de production. Exportez le grand fichier de production seulement quand vous en avez vraiment besoin."],
        ['Avancé', "utilisez les contrôles plus poussés uniquement lorsque vous en avez besoin."]
      ],
      important: "Important : Un aperçu n'est pas un fichier de production. Une recette enregistrée n'est pas une licence commerciale.",
      paidTitle: 'Commandes payantes',
      paid: "Les commandes payantes sont actuellement organisées directement avec nous. Vous nous expliquez ce dont vous avez besoin, nous confirmons le périmètre, le prix et les droits d'utilisation, vous approuvez la commande, le paiement est effectué par facture ou par un autre moyen professionnel convenu, puis nous livrons les fichiers finaux convenus ainsi que les droits d'utilisation écrits."
    },
    es: {
      name: 'Español',
      whatTitle: '¿Qué es EMVY CHECK?',
      what: 'EMVY CHECK es un sistema creativo para crear, encargar, producir y licenciar arte visual. Puedes experimentar por tu cuenta en Canvas Grid, pedirnos que creemos una obra para ti o contactar con nosotros sobre uso comercial y producción.',
      startTitle: 'Empieza aquí',
      start: [
        ['CREAR', 'Abre Canvas Grid y experimenta.'],
        ['ENCARGAR', 'Pide a EMVY CHECK que cree una obra para ti.'],
        ['COMERCIAL', 'Pregunta sobre impresión, venta, fabricación o uso empresarial.'],
        ['SOCIOS', 'Trabaja con EMVY CHECK en un proyecto real.'],
        ['AYUDA', 'Contacta con nosotros si no tienes claro qué necesitas.']
      ],
      basicsTitle: 'Conceptos básicos de Canvas Grid',
      basics: [
        ['Motivo', 'elige la estructura visual inicial.'],
        ['Formato', 'elige la forma del panel o de la composición.'],
        ['Composición', 'usa un motivo o combina estructuras.'],
        ['Look', 'cambia el tratamiento visual.'],
        ['Color', 'prueba distintas direcciones de color.'],
        ['Seed', 'crea variaciones relacionadas de la misma idea.'],
        ['Vista previa', 'comprueba cómo puede verse la obra en paneles o en una habitación.'],
        ['Guardar receta', 'guarda el archivo ligero de reconstrucción — conserva tu configuración para que puedas volver a abrirla y reproducir una obra compatible más adelante, en lugar de guardar cada enorme imagen de producción. Exporta el archivo de producción grande solo cuando realmente lo necesites.'],
        ['Avanzado', 'usa los controles más profundos solo cuando los necesites.']
      ],
      important: 'Importante: Una vista previa no es un archivo de producción. Una receta guardada no es una licencia comercial.',
      paidTitle: 'Pedidos de pago',
      paid: 'Los pedidos de pago se gestionan actualmente mediante conversación directa. Nos dices qué necesitas, confirmamos el alcance, el precio y los derechos de uso, apruebas el pedido, el pago se realiza mediante factura u otro método comercial acordado y entregamos los archivos finales acordados junto con los derechos de uso por escrito.'
    },
    pl: {
      name: 'Polski',
      whatTitle: 'Czym jest EMVY CHECK?',
      what: 'EMVY CHECK to kreatywny system do tworzenia, zamawiania, produkcji i licencjonowania sztuki wizualnej. Możesz samodzielnie eksperymentować w Canvas Grid, zlecić nam wykonanie pracy albo skontaktować się z nami w sprawie wykorzystania komercyjnego i produkcji.',
      startTitle: 'Zacznij tutaj',
      start: [
        ['TWÓRZ', 'Otwórz Canvas Grid i eksperymentuj.'],
        ['ZAMÓW', 'Zleć EMVY CHECK wykonanie pracy dla Ciebie.'],
        ['KOMERCYJNIE', 'Zapytaj o druk, sprzedaż, produkcję lub wykorzystanie biznesowe.'],
        ['PARTNERZY', 'Współpracuj z EMVY CHECK przy realnym projekcie.'],
        ['POMOC', 'Skontaktuj się z nami, jeśli nie wiesz dokładnie, czego potrzebujesz.']
      ],
      basicsTitle: 'Podstawy Canvas Grid',
      basics: [
        ['Motyw', 'wybierz początkową strukturę wizualną.'],
        ['Format', 'wybierz kształt panelu lub układu.'],
        ['Kompozycja', 'użyj jednego motywu albo połącz kilka struktur.'],
        ['Wygląd', 'zmień sposób opracowania wizualnego.'],
        ['Kolor', 'wypróbuj różne kierunki kolorystyczne.'],
        ['Seed', 'twórz powiązane warianty tego samego pomysłu.'],
        ['Podgląd', 'zobacz, jak praca może wyglądać jako panele lub w pomieszczeniu.'],
        ['Zapisz recepturę', 'zapisz lekki plik do odtworzenia — zachowuje twoje ustawienia, dzięki czemu możesz później ponownie otworzyć i odtworzyć kompatybilną pracę, zamiast przechowywać każdy ogromny plik produkcyjny. Duży plik produkcyjny eksportuj dopiero wtedy, gdy naprawdę go potrzebujesz.'],
        ['Zaawansowane', 'używaj bardziej szczegółowych ustawień tylko wtedy, gdy ich potrzebujesz.']
      ],
      important: 'Ważne: Podgląd nie jest plikiem produkcyjnym. Zapisana receptura nie jest licencją komercyjną.',
      paidTitle: 'Płatne zamówienia',
      paid: 'Płatne zamówienia są obecnie ustalane bezpośrednio. Mówisz nam, czego potrzebujesz, potwierdzamy zakres, cenę i prawa do wykorzystania, zatwierdzasz zamówienie, płatność odbywa się na podstawie faktury lub inną uzgodnioną metodą biznesową, a następnie dostarczamy uzgodnione pliki końcowe oraz pisemne prawa do wykorzystania.'
    }
  };

  var ORDER = ['en', 'cs', 'hr', 'de', 'fr', 'es', 'pl'];
  var STORAGE_KEY = 'emvy-lang-help';

  var CSS = [
    '#emvy-lang-toggle{position:fixed;left:16px;bottom:16px;z-index:60;border:1px solid #555;background:rgba(17,17,17,.92);color:#f1eee8;',
    'border-radius:999px;padding:10px 15px;font:800 12px/1 Arial,Helvetica,sans-serif;cursor:pointer;backdrop-filter:blur(8px)}',
    '#emvy-lang-toggle:hover{border-color:#888}',
    '#emvy-lang-panel{position:fixed;left:16px;bottom:66px;z-index:60;width:min(360px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;',
    'background:#111;color:#f1eee8;border:1px solid #2b2b2b;border-radius:10px;padding:18px;font-family:Arial,Helvetica,sans-serif;',
    'box-shadow:0 20px 50px rgba(0,0,0,.5);display:none}',
    '#emvy-lang-panel.on{display:block}',
    '#emvy-lang-panel h2{font-size:15px;margin:0 0 12px;letter-spacing:-.01em}',
    '#emvy-lang-panel .emvy-lang-picker{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}',
    '#emvy-lang-panel .emvy-lang-picker button{font-size:11px;font-weight:800;border:1px solid #3a3a3a;background:#0d0d0d;color:#c9c3bb;',
    'border-radius:999px;padding:6px 10px;cursor:pointer}',
    '#emvy-lang-panel .emvy-lang-picker button.on{background:#d8ff35;border-color:#d8ff35;color:#0b0b0b}',
    '#emvy-lang-panel .emvy-lang-body h3{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ff4f1f;margin:16px 0 8px}',
    '#emvy-lang-panel .emvy-lang-body h3:first-child{margin-top:0}',
    '#emvy-lang-panel .emvy-lang-body p{font-size:13px;line-height:1.5;color:#c9c3bb;margin:0 0 10px}',
    '#emvy-lang-panel .emvy-lang-route,#emvy-lang-panel .emvy-lang-term{font-size:13px;line-height:1.5;color:#c9c3bb;margin:0 0 8px}',
    '#emvy-lang-panel .emvy-lang-route b,#emvy-lang-panel .emvy-lang-term b{color:#f1eee8}',
    '#emvy-lang-panel .emvy-lang-note{margin-top:14px;padding-top:12px;border-top:1px solid #2b2b2b;font-size:11px;color:#7f7972;line-height:1.5}',
    '#emvy-lang-close{position:absolute;top:12px;right:14px;background:none;border:0;color:#7f7972;font-size:16px;cursor:pointer;line-height:1}',
    '@media(max-width:480px){#emvy-lang-toggle{left:10px;bottom:10px}#emvy-lang-panel{left:10px;bottom:56px}}'
  ].join('');

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) { for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } }
    (children || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  function render(panel, body, lang) {
    var d = LANGS[lang] || LANGS.en;
    body.innerHTML = '';
    body.appendChild(el('h3', { text: d.whatTitle }));
    body.appendChild(el('p', { text: d.what }));
    body.appendChild(el('h3', { text: d.startTitle }));
    d.start.forEach(function (r) {
      var p = el('p', { class: 'emvy-lang-route' });
      p.appendChild(el('b', { text: r[0] + ' — ' }));
      p.appendChild(document.createTextNode(r[1]));
      body.appendChild(p);
    });
    body.appendChild(el('h3', { text: d.basicsTitle }));
    d.basics.forEach(function (b) {
      var p = el('p', { class: 'emvy-lang-term' });
      p.appendChild(el('b', { text: b[0] + ' — ' }));
      p.appendChild(document.createTextNode(b[1]));
      body.appendChild(p);
    });
    body.appendChild(el('p', { text: d.important }));
    body.appendChild(el('h3', { text: d.paidTitle }));
    body.appendChild(el('p', { text: d.paid }));
    var note = el('p', { class: 'emvy-lang-note', text: 'English remains the authoritative language for legal and commercial terms. These translations are for orientation only.' });
    body.appendChild(note);
  }

  function install() {
    if (document.getElementById('emvy-lang-toggle')) return;
    var style = document.createElement('style');
    style.id = 'emvy-lang-help-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var saved = 'en';
    try { saved = localStorage.getItem(STORAGE_KEY) || 'en'; } catch (e) {}
    if (!LANGS[saved]) saved = 'en';

    var toggle = el('button', { id: 'emvy-lang-toggle', type: 'button', text: '🌐 Language / Quick guide' });
    var panel = el('div', { id: 'emvy-lang-panel' });
    var close = el('button', { id: 'emvy-lang-close', type: 'button', 'aria-label': 'Close' , text: '✕'});
    var h2 = el('h2', { text: 'Quick guide' });
    var picker = el('div', { class: 'emvy-lang-picker' });
    var body = el('div', { class: 'emvy-lang-body' });

    ORDER.forEach(function (code) {
      var b = el('button', { type: 'button', text: code.toUpperCase(), 'data-lang': code });
      if (code === saved) b.className = 'on';
      b.onclick = function () {
        picker.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        render(panel, body, code);
        try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
      };
      picker.appendChild(b);
    });

    panel.appendChild(close);
    panel.appendChild(h2);
    panel.appendChild(picker);
    panel.appendChild(body);
    render(panel, body, saved);

    toggle.onclick = function () { panel.classList.toggle('on'); };
    close.onclick = function () { panel.classList.remove('on'); };

    document.body.appendChild(toggle);
    document.body.appendChild(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
