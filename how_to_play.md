
## How to play

1. **New Game** (File ▸ New Game…): choose map size, water, rivers, wrapping,
   number of AI opponents, and more, then **Create Map**.
2. On your turn, **right-click** a habitable land cell (grassland, hills,
   plains, forest, jungle, desert, wetlands, or mountains) and choose
   **Establish Colony**. You start with one colony module.
3. **Double-click your biodome** to open the colony view: a hex map of your
   zone of control showing each cell's Food / Material / Energy / Happiness
   (as `base+bonus`), plus a **statistics panel** with population, growth rate,
   each resource as **stored / cap · rate**, and a **Buildings** list showing
   each building's per-year bonuses (and whether it's idle). Click cells to
   assign workers (worked cells turn red). The biodome cell is always worked;
   you can work up to `floor(population / 1000)` additional cells. **A building
   only contributes while its cell is worked** (production, upkeep, and
   storage) — deselect a building's cell to idle it: it drops its upkeep but
   also stops producing and no longer provides storage.
4. **Build** Farms, Solar Panels, and Factories by right-clicking a cell in your
   zone of control. Each costs Material/Energy/Wealth (paid from that colony's
   storage), adds storage and per-year upkeep, and may require **prerequisite
   buildings** (e.g. a Factory needs a Solar Panel). Disabled build options show
   why (insufficient resources, missing prerequisite, or outside your zone).
   To tear a building down, right-click its cell and choose **Remove
   Improvement** (costs Energy + Food from the colony and takes a couple of
   turns to complete). Build **Roads**, **Monorails**, and **Canals** the same
   way (right-click within a colony's zone), and right-click a road/monorail
   tile to **Remove Transportation** — its cost (`removeTransportCost`) is paid
   by the nearest colony (within `minColonyDistance`), borrowing from connected
   colonies if needed.
5. **Found new colonies** once a colony grows past the population threshold
   (3,000): right-click that biodome and choose **Found New Colony**, then click
   a distant land cell to plant it. A green line (color configurable via
   `launchPathColor`) previews the overland path; the
   new biodome costs the host colony a Biodome's resources plus 1,000 colonists
   and arrives after its build time plus travel time (based on terrain movement
   cost and river crossings). You'll be asked to name the new colony.
6. **End your turn** with the **End Turn** menu item (or Cmd/Ctrl + Return). The
   game never auto-advances while you still have an action available (a worker to
   assign, a building to construct, or a colony to launch). When you're out of
   actions, the **Auto turn end** setting decides what happens: if on (default)
   your turn ends automatically; if off, you always end it yourself with End Turn.
7. Watch **Year**, **Population**, and **Resources** in the right-hand panels.
   The AIs take their turns automatically; a new colony or a new year raises a
   notification. **The goal is to build the largest civilization you can** —
   grow your total population across as many colonies as possible.

### Controls
| Action | Key / Input |
| --- | --- |
| Pan by 2 hexes | Arrow keys |
| Pan by one screen | Shift + Arrow keys |
| Pan (either axis) | Mouse wheel / trackpad |
| Zoom in / out | Cmd/Ctrl + `=` / Cmd/Ctrl + `-` |
| Toggle terrain textures | Cmd/Ctrl + `T` |
| Toggle Area-of-Control view | Cmd/Ctrl + Shift + `C` |
| View home colony | Cmd/Ctrl + Opt + `H` |
| View a location / colony / alien | View menu |
| End turn | Cmd/Ctrl + Return |
| Force-end a stuck AI turn | Ctrl + Esc |
| Establish / build | Right-click a cell |
| Colony work assignment | Double-click a colony |
