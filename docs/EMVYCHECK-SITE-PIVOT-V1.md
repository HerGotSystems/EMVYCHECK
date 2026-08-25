# EMVY CHECK site pivot v1

Decision: emvycheck.com is no longer primarily the music-player homepage.

The root site becomes the public commercial front door for EMVY CHECK / Canvas Grid / EMVY CHECK ART. Music remains an important EMVY CHECK project but moves to its own clearly visible section instead of occupying the homepage.

## Brand hierarchy

EMVY CHECK

- Canvas Grid — creation system / paid creator product
- EMVY CHECK ART — commissioned, bespoke and collaborative artwork
- Business / Partners — printers, designers, hotels, schools, galleries, artists, fit-out, hospitality, production partners
- Interactive Projects — group art, exhibitions, corporate/school projects
- EMVY CHECK MUSIC — existing music catalogue/player, preserved as a first-class side route

## Root homepage job

The homepage has one purpose: make a visitor understand quickly that EMVY CHECK helps people create, commission, transform, produce and sell visual work.

Do not make the homepage explain every technical detail.

Lead with results and routes.

Working hero direction:

EMVY CHECK

CREATE SOMETHING THAT IS YOURS.

Create it. Commission it. Transform it. Print it. Sell the licensed work. Build something together.

Primary CTAs:
- CREATE WITH CANVAS GRID
- COMMISSION ARTWORK

Secondary CTA:
- FOR BUSINESS & PARTNERS

## Homepage structure

1. HERO
   Strong real Canvas Grid artwork / GRID9 visual. Clear CTA.

2. CHOOSE YOUR ROUTE
   Six cards:
   - Create for yourself
   - Create commercially
   - Commission artwork
   - Business & production partners
   - Interactive / group projects
   - Music

3. CANVAS GRID FEATURE
   Show the actual system through finished outputs, not an interface screenshot first.
   Message: make many related but original works; choose colours, layouts and variations; register/licence eligible work; produce locally or through partners.

4. EMVY CHECK ART
   Bespoke artwork for homes, hotels, restaurants, offices, schools, public/commercial spaces.
   Working premium-space idea: creative/design fee from approx. £1,000/m²; printing/fabrication/framing/installation additional.
   Do not imply this price applies to ordinary merchandise or every Canvas Grid use.

5. BUSINESS / PARTNERS
   Short routes for:
   - printers / framers / sign / fabrication shops
   - interior designers / architects / fit-out
   - hotels / hospitality / property
   - schools / universities
   - galleries / events
   - local artists
   Message: use Canvas Grid to add a service, create faster, fulfil authorised work and make money together.

6. INTERACTIVE PROJECTS
   GRID9 / larger group pieces, gallery/public participation, company team artwork, school projects, collaborative local-artist finishing.

7. HOW IT WORKS
   CREATE → REGISTER → LICENSE → PRODUCE
   Keep the Art Code / provenance / production-job concept understandable, not technical.

8. MUSIC STRIP
   EMVY CHECK MUSIC remains visible but compact on the homepage.
   Example:
   "EMVY CHECK also makes music. Listen free, no adverts."
   CTA: LISTEN TO EMVY CHECK MUSIC

9. CONTACT / COLLABORATE
   emvycheck@gmail.com
   Simple invitation: customer, business, artist, printer or venue — tell us what you want to make.

## Navigation

Desktop/mobile top navigation should stay small:

EMVY CHECK
ART
CANVAS GRID
BUSINESS
PARTNERS
MUSIC

Avoid a 12-item menu.

## URL direction

/                         new commercial/brand homepage
/art/                     EMVY CHECK ART
/create/ or Canvas Grid   public Canvas Grid route/product CTA
/business/                organisations / commissioned use
/partners/                printers, designers, artists, production partners
/projects/                interactive/group projects
/music/                   existing music experience/player

Exact Canvas Grid public hostname can remain separate (e.g. canvas/create subdomain) while emvycheck.com acts as the public brand/offer front door.

## Music migration rule

Do not delete or rebuild the existing player unnecessarily.

Preserve the current working music experience and move it behind /music/ (or an equivalent clean route) with minimal functional change.

Before moving it:
- inventory root-relative/local asset paths
- preserve R2/media URLs
- preserve playlist behaviour
- preserve mobile/car-audio fixes
- preserve direct links where practical
- add redirects only where needed

The homepage should still link to music prominently enough that existing music visitors can find it immediately.

## Visual direction

Use the EMVY CHECK visual identity, but this must look like an art/creative company rather than a software dashboard.

- real Canvas Grid artwork as dominant visual material
- black / near-black with strong high-contrast colour accents where useful
- big confident typography
- clean commercial hierarchy
- controlled KINEOSTROKE / glitch influence, not visual noise everywhere
- results first, interface second

The public site should feel credible to an individual buying a £5 subscription and also to a hotel, printer or designer discussing a multi-thousand-pound project.

## What not to do

- Do not make music disappear.
- Do not keep music as the main homepage purpose.
- Do not expose the private Master Studio.
- Do not dump every Canvas Grid technical feature on the homepage.
- Do not make separate disconnected mini-brands for every audience.
- Do not promise partner/job-code features as live until they are actually implemented.
- Do not launch twenty thin audience pages before the core homepage is strong.

## Immediate implementation sequence

1. Freeze/copy current root music player into a safe /music/ candidate and prove it works there.
2. Build the new root homepage on this feature branch.
3. Link Canvas Grid paid-beta/public product without exposing Master.
4. Add Art / Business / Partners sections initially as strong landing sections/pages, not huge systems.
5. Mobile-first test because the owner will operate/review from phone for part of launch week.
6. Only after human review: merge/deploy.

No production change is authorised by this planning document.