# EMVY CHECK — Room Preview v0.1

Goal: create a local-first sales prototype where a customer can upload a room photo, mark a wall with four draggable perspective corners, choose existing EMVY showcase artwork, preview it as 1×1, 3×3 or 5×5, adjust spacing/opacity, and save a flattened preview.

Privacy: room photos stay in the browser in v0.1. No backend storage, accounts, analytics payload, or room-project sharing is introduced.

Rendering: artwork is perspective-warped into the wall quadrilateral using a triangle mesh. Grid modes divide the source artwork into N×N cells and map each cell into the corresponding wall cell.

Non-goals: automatic wall detection, physical measurement calibration, persistent room projects, shared private links, A/B/C proposal sets, live Canvas generation, AR, and 3D cube placement.

Next: v0.2 should add one physical wall measurement and local project JSON. v0.3 can add private customer/EMVY room projects.