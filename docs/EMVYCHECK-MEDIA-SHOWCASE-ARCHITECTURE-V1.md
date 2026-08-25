# EMVY CHECK media / showcase architecture v1

Goal: show a lot of art beautifully, keep loading fast and cheap, preserve reproducibility, support future creator showcases and print/mockup views, and avoid storing giant production files unless they are genuinely needed.

## 1. Music should be optional but persistent when chosen

Desired visitor behavior:

- Visitor can browse EMVY CHECK silently.
- Visitor can start music if they want it.
- Once music is playing, moving around the EMVY CHECK site should not stop it unless the visitor pauses/stops it.

Best long-term implementation: one persistent site shell with one global audio player instance. Navigation between Home / Art / Business / Partners / Music should swap views with client-side routing rather than causing a full document reload.

Do not try to make a service worker play audio; service workers are not the playback document.

Migration path:

1. Keep the current /music/ player working exactly as it does now.
2. Extract playback state/audio element/controller into a reusable `emvy-audio-core.js` module.
3. Root site owns the audio core permanently.
4. Music page becomes the full music UI for the same player, not a second player.
5. Add a small optional sticky mini-player on non-music views only after the visitor has chosen to play something.
6. Save track/position/queue intent locally so a browser reload can offer to resume, but never autoplay without browser/user permission.

Short-term fallback if full shell refactor is not ready: music continues to stop on hard navigation. Do not add fragile hacks such as hidden popup windows or background tabs just to fake persistence.

## 2. Never use production print files as website images

Production masters may be huge and belong in the production workflow, not the marketing site.

For every showcased artwork create small web derivatives only.

Recommended web derivative set:

- `thumb` — 320 px long edge, AVIF preferred, WebP fallback if needed
- `card` — 768 or 960 px long edge, AVIF/WebP
- `detail` — 1600 or 2048 px long edge, AVIF/WebP
- optional social/share image — 1200×630 JPEG/WebP when needed

Do not routinely serve anything larger than about 2048 px for normal web viewing. A phone cannot meaningfully display the difference but users still pay the bandwidth/time cost.

Keep true print files outside the public showcase path.

## 3. Storage layout

Do not put a growing art library of binary images in the Git repository.

Use the existing media domain / Cloudflare object storage for showcase derivatives once the library grows.

Suggested layout:

`media.emvycheck.com/ART/showcase/<artwork-id>/thumb.avif`
`media.emvycheck.com/ART/showcase/<artwork-id>/card.avif`
`media.emvycheck.com/ART/showcase/<artwork-id>/detail.avif`

Optional fallbacks:

`.../card.webp`
`.../detail.webp`

Use immutable/hash-versioned filenames or artwork/version directories and long browser cache headers so repeated viewing costs almost nothing.

The metadata for each work stays tiny and can live in JSON/D1:

- artwork/showcase id
- title
- creator id / mark / display name
- Art Code or provenance id when public
- renderer identity/version
- derivative URLs
- aspect ratio / grid layout
- tags / collection
- commercial/provenance status
- wall/mockup presets allowed

## 4. Art Code showcase: hybrid, not live-render-everything

This is a strong Canvas Grid differentiator.

Each showcase card should normally use a pre-rendered lightweight preview image. Do NOT run the Canvas Grid renderer for every artwork card on initial page load.

On an artwork detail page we can expose:

- title / creator
- preview
- public provenance / licence status where appropriate
- Art Code or a short public artwork/showcase reference
- `RECREATE IN CANVAS GRID` / `OPEN THIS ART CODE` button

When the visitor explicitly chooses to recreate it, Canvas Grid renders in that visitor's browser using the stored Art Code and correct renderer compatibility rules.

Benefits:

- gallery loads instantly
- tiny server/storage cost
- actual reproducibility remains demonstrable
- client CPU is only used on demand
- no server render farm required

Never depend on "current renderer" alone for historical work. Store renderer/identity compatibility metadata so an old Art Code does not silently change appearance years later.

## 5. Wall / installation visualiser without storing five mockups per artwork

Do not generate and store a separate room JPG for every artwork × every room.

Build reusable scene templates.

A scene template contains:

- one compressed room/wall background image
- placement rectangle/polygon for the artwork
- physical wall dimensions or relative scale
- optional frame/mat/gap settings
- optional lighting/shadow parameters

Then the browser composites the artwork's `card` or `detail` preview into the scene with Canvas/SVG/CSS transforms.

Example reusable scenes:

- living room
- hotel bedroom
- reception / lobby
- office meeting room
- restaurant
- school corridor
- gallery wall
- large feature wall

One background can display thousands of artworks. One artwork can be shown in eight environments without eight extra stored mockups.

For GRID9 / multi-panel works, the scene template uses layout metadata to draw each panel and correct gaps.

For angled walls or more complex perspective, Canvas/SVG scene coordinates can define four corner points for the artwork area rather than storing a flattened mockup.

## 6. Creator / community showcases

Do not automatically store every experiment every user generates.

Store only work a creator explicitly chooses to publish/showcase/register.

A future public creator gallery can therefore be cheap:

Creator profile
→ selected showcase metadata
→ small derivatives
→ Art Code/provenance reference

The production master remains the creator's/download workflow unless they deliberately purchase/use cloud archive storage.

This prevents R2 becoming a landfill of abandoned generations.

## 7. Private originals / production archives

Possible tiers later:

- Default: no cloud production master at all; regenerate/download locally.
- Optional archive: user explicitly saves a production master to R2.
- Required archive: only when exact future reproduction cannot safely be guaranteed from Art Code alone (external image assets, manually modified source files, etc.).

External images are different from deterministic Canvas Grid recipes: if an artwork depends on uploaded source imagery, the exact source asset/hash must be retained somewhere if exact reproduction is promised.

## 8. Preferred image formats

For website artwork:

1. AVIF — smallest files for photographic/complex art when encode quality is acceptable.
2. WebP — excellent broad fallback and often faster/easier to produce.
3. JPEG — useful for social/open-graph and compatibility, not the primary archive.
4. PNG — reserve for transparency, sharp graphics that compress badly in lossy formats, or production files. Do not use giant PNGs for normal gallery cards.

A simple first workflow for Michal is acceptable:

- export/copy chosen artwork
- resize to 1600–2048 px long edge
- save high-quality WebP (around quality 80–88) for `detail`
- make 800–960 px WebP for `card`
- make ~320 px WebP for `thumb`

We can automate AVIF/WebP derivative generation later so the creator only supplies one source image.

## 9. What the homepage should load

Keep initial homepage payload extremely small.

- 1 strong hero artwork derivative
- 3–6 selected art cards maximum above the fold / early page
- lazy-load everything else
- wall visualiser backgrounds load only when that section becomes visible or opened
- do not initialise Canvas Grid renderer until somebody asks to recreate/open an Art Code
- do not initialise full music catalogue/player UI until needed; persistent audio core can remain tiny

## 10. Public showcase object model (working shape)

```json
{
  "id": "EC-W-2026-...",
  "title": "Frost Fractures",
  "creator": {
    "creatorId": "EC-A-...",
    "creatorMark": "MV79",
    "artistName": "EMVY CHECK"
  },
  "preview": {
    "thumb": ".../thumb.avif",
    "card": ".../card.avif",
    "detail": ".../detail.avif",
    "aspectRatio": 1.0
  },
  "artCode": "CG8-...",
  "renderer": "canvas-grid-render-...",
  "provenanceId": null,
  "commercialReleaseId": null,
  "scenes": ["living-room-01", "hotel-01", "gallery-01"]
}
```

Exact IDs/schema can change before implementation; this illustrates the separation between tiny metadata, web preview and production file.

## 11. Principle

Website = previews + metadata + reproducibility.

Canvas Grid = renderer.

R2 = only assets worth storing.

Browser = does expensive reconstruction/mockup work when the visitor asks for it.

Production files = generated/downloaded when needed, not duplicated everywhere forever.
