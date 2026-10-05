<style>
.float-left {
  float: left;
  margin: 0 1em 0 0;
}
.float-right {
  float: right;
  margin: 0 0 0 1em;
}

th, td {white-space: normal; word-break: keep-all;}
</style>

# Zubrenn

Zubrenn is a turn-based, hex-grid 4X-style strategy game built with
[Electron](https://www.electronjs.org/). Explore a procedurally generated
continent, establish colonies, work the land, build infrastructure, and compete
with alien AI opponents for resources.

![Zubrenn](Zubrenn.png)

## Features

- **Procedural hex-map generation** — fractal terrain (diamond-square / fBm),
  biomes (sea, grassland, plains, hills, forest, jungle, desert, wetlands,
  mountains, frozen),
  elevation, and rivers that flow from mountains to the sea.
- **Cylindrical (east–west) wrapping** — the map can wrap so the left and right
  edges meet; you can scroll continuously around the world.
- **Rivers** — flow downhill to the sea, follow cell borders, and give adjacent
  land extra food. Every mountain region gets at least two rivers.
- **Colonies & buildings** — found colonies (Biodomes) and build Farms, Solar
  Panels, Factories, and **Docks** within your zone of control.
- **Economy** — a single, config-driven model governs seven resource types
  (**Energy, Food, Material, Water, Wealth, Happiness, Population**) identically
  for you and the AI. Each colony holds its own **owned** amounts for all seven,
  clamped to its **max storage** (the sum of the `storage` keys of its worked
  buildings and worked cells). Each turn a colony's **delta** per resource is the
  sum, over its biodome and worked cells, of terrain `base` + terrain-bonus
  `bonus` + building `bonus`, minus population consumption
  (`unitCosts.population`). A building only contributes — production, upkeep,
  **and storage** — when its cell is **worked**. Shortfalls are covered by
  **borrowing** from the Federation and connected colonies; if still short, the
  colony **idles** worked cells; surplus beyond a colony's max **overflows** into
  the Federation pool.
- **Federation** — all of a player's colonies form a Federation with its own
  pooled **owned** resources and **max storage** (the sum of worked buildings'
  `federationStorage`). The Federation **treasury** is its owned Wealth. The
  earliest-founded surviving colony is the **capital**; only colonies network-
  connected to the capital can draw from (or overflow into) the Federation pool.
- **Happiness & growth** — each colony accumulates **happiness** (owned) from its
  food balance, buildings, and terrain, clamped to ±its happiness storage.
  Population grows each turn by a percentage = the sum of `bonus.population`
  values on its worked cells/buildings plus a happiness bonus (positive happiness
  grows the population, negative shrinks it). Federation happiness is the
  population-weighted average of its colonies.
- **Prerequisites** — some buildings require others first (e.g. a Factory needs
  a Solar Panel in the colony).
- **Transport network** — build **Roads** and **Monorails** overland, dig
  **Canals** along cell borders, and build **Docks** and **Air Fields**. Paths
  are plotted cell-by-cell (choosing the most direct of equal-length routes);
  road/monorail bridges may span a single sea tile. Right-click a
  road/monorail tile to **Remove Transportation**.
- **Connected colonies share resources** — colonies you own that are linked by
  road/monorail, a river/canal path, a **sea** route (both have a Dock), or an
  **air** route (both have an Air Field within its `range`) can cover each
  other's shortfalls, borrowing from whichever connected colony stores the most
  of a resource.
- **Found new colonies** — a colony above a population threshold can launch a
  new biodome to a distant land cell; the materials travel overland (time based
  on terrain movement cost and river crossings), transferring colonists and
  paying the biodome cost from the host colony. During placement, cells that are
  unsuitable (bad terrain or too close to an existing colony) are shaded gray.
- **AI opponents** — configurable number of alien species establish and grow
  their own colonies. If an AI turn stalls, **Ctrl+Esc** force-ends it.
- **Fog of war** — the map starts hidden under light-gray fog except a
  radius-20 circle around a random land tile. Founding one of your colonies
  reveals a radius-15 circle around it. Explored visibility is saved and
  restored with the game.
- **Background music** — a looping theme plays in the game window, with on/off
  and volume controls in Settings ▸ Audio (paused while the Backstory is shown).
- **Area-of-Control view**, minimap, hover tooltips (terrain yields as
  `E/F/M/W/H`, plus any road/monorail and colony/building on the tile), a colony
  work view with per-cell base + bonus tooltips, save/load, and a
  fully-`config.json`-driven ruleset.

# Nexus Data Core

Welcome, Administrator. The Nexus Data Core is your field reference for the colonization of **Zubrenn**.

## Contents

- [How to Play](how_to_play.md) — turn flow, founding colonies, and controls
- [Resources](resources.md) — the seven resources and the colony economy
- [Terrain](terrain.md) — the eleven terrain types and what they yield
- [Terrain Bonus](terrain_bonus.md) — special resource deposits across the land
- [Buildings](buildings.md) — every structure, its costs, upkeep, and output
- [Transportation](transportation.md) — roads, rivers, sea, monorail, air, space
- [Federation](federation.md) — the capital, treasury, taxes, and shared upkeep
- [Alien Species](aliens.md) — the peoples who contest the continent

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) (with npm)

### Install & run
```bash
npm install
npm start
```

> Note: `src/license.cjs` (which holds the license salt) is git-ignored and is
> generated by the build scripts. You may need to create it locally to run from
> source.

### Build distributables
```bash
npm run dist:mac:x64     # macOS Intel
npm run dist:mac:arm64   # macOS Apple Silicon
npm run dist:win:x64     # Windows
npm run dist:linux:x64   # Linux
npm run dist:all         # everything
```

## Project structure

```
Zubrenn/
├── package.json            # Electron app + electron-builder config
├── src/
│   ├── main.js             # Electron main process (windows, menus, save/load)
│   ├── index.html          # Renderer: game state, economy, turns, UI
│   ├── draw_map.cjs        # Hex-map renderer (terrain, rivers, buildings, minimap)
│   ├── generate_map.cjs    # Procedural terrain + river generation
│   ├── config.json         # All game rules & content (see below)
│   ├── settings.js         # Persisted user settings
│   ├── newgame.html         # New Game dialog
│   ├── settings.html / about.html / splash.html / license_dialog.html
│   ├── styles.css
│   └── resources/          # Icons + terrain tiles + system_prompt.md
└── README.md
```

## Configuration (`src/config.json`)

Almost all rules and content live in `config.json`, so the game can be tuned
without code changes:

- `terrainTypes` — per terrain code: display name, tile icon, HSV color, a
  `base` Food/Material yield (per 1,000 workers), a `movement` cost array
  `[unimproved, road, sea (or river), monorail, air]` (the movement-point cost
  to enter that tile by each mode; lower is cheaper/faster), and per-tile
  transport build costs `roadCostPerTile`, `monorailCostPerTile`, and
  `canalCostPerEdge`.
  Terrain codes are `1` Sea, `2` Grassland, `3` Hills, `4` Forest, `5` Jungle,
  `6` Desert, `7` Mountain-Low, `8` Mountain-High, `9` Frozen, `10` Plains, and
  `11` Wetlands (Marsh). All of `2–11` count as **land**; everything except
  Mountain-High (8) and Frozen (9) is **habitable/buildable**. During
  generation, upper-elevation grassland is converted to **Plains (10)**, and
  land that is **both sea-adjacent and river-adjacent** is converted to
  **Wetlands (11)** (which also grants a small happiness bonus).
- `buildingTypes` — keyed by the **lowercase building name** (e.g. `"solar panel"`,
  `"air field"`); each entry carries a numeric **`code`** (the stable type id used
  internally and stored in save files). Covers the Biodome, Farm, Solar Panel,
  Factory, Dock, Air Field, and the storage/utility buildings:
  - `buildCost` — one-time Material/Energy/Wealth cost to construct (its `turns`
    is the build time, not a payable resource).
  - `costPerYear` — per-year upkeep (Material/Energy/Wealth) subtracted from output.
  - `bonus` — per-year production: `food`, `material`, `energy`, `wealth`, and
    `growth` (growth-rate modifier). Only applied when the building's cell is worked.
  - `storage` — how much Food/Material/Energy/Wealth/Happiness this building can
    hold; a colony's cap for each is the **sum** of its buildings' storage.
  - `prerequisite` — all build-eligibility requirements for the building, as an
    object with optional keys:
    - `building` — **lowercase building-name keys** (e.g. `["solar panel"]`) that
      must **all** already exist in the colony (e.g. the Factory requires a Solar
      Panel).
    - `network` — a list of transport-connection types the colony must have to
      **another** of your colonies (satisfied by **any one** listed): `"land"`
      (road or monorail), `"river"` (river/canal), `"sea"`, `"air"`, `"space"`,
      or `"any"` (any connection at all). Omitted/empty means no network needed.
    - `terrain` — terrain **name keys** the building may be placed on (defaults to
      habitable land).
    - `other` — extra per-cell placement tags (same vocabulary as a
      terrain-bonus's `other`): e.g. `"sea"` (on a shallow-sea tile), `"river"`
      (river/canal-adjacent land), `"water"`/`"dry"`, or elevation bands. All
      listed tags must hold.
      The special tag `"anywhere"` waives the colony zone-of-control
      requirement: the building may be placed on any explored cell that is not
      inside another player's zone of control (its cost is paid by, and it is
      owned by, the owner's nearest colony).
    - `climate` — climate band names (`"tropical"`/`"temperate"`/`"subpolar"`/
      `"polar"`) the cell must be in. Omitted means any climate.
    - `citySize` — the colony population must be **≥ `citySize` × 1,000**.
  - `range` — for the **Air Field**, the maximum hex distance for an air link:
    two colonies that each have an Air Field within this distance are connected
    (and can share resources).
- `bridgeCost`, `roadColor`, `monorailColor`, `riverColor`, `canalColor`,
  `bridgeColor`, `planningPathColor`, `underConstructionColor`, `launchPathColor`,
  `workedCellColor` — transport/overlay costs and colors.
- `zoneOfControlSize` — population thresholds that expand a colony's control radius.
- Economy constants: `unitCosts.population` (per-1,000-colonist consumption of
  each resource, with `unitSize`), `happinessGrowthPerUnit` and
  `maxHappinessGrowthBonus` (how food/terrain/building happiness converts to a
  population-growth bonus, capped), `riverAdjacentBonus` and `seaAdjacentBonus`
  (per-resource yields for cells beside a river/canal or the sea), and
  `federationTaxRate` (per-colony happiness penalty funding the Federation).
  Each building may define `federationStorage` (its contribution to the
  Federation's pooled max storage).
- `removeImprovementCost` (remove a building), `removeCanalCost` (remove a
  canal), and `removeTransportCost` (remove a road/monorail) — each an
  Energy/Food cost plus a `turns` completion time.
- Founding new colonies: `foundColonyMinPopulation` (population needed to launch),
  `foundColonyPopulationTransfer` (colonists moved to the new colony),
  `biodomeMovementPerYear` (overland movement points per year),
  `riverCrossingMovementCost`, and `maxAltitudeMeters` (the highest elevation
  tier — the mountain tops — is impassable).
- Game setup: `startingYear`, `maxAIs`, `minColonyDistance`,
  `aiPlacementMinTurns`/`aiPlacementMaxTurns`, and 100 alien `names`.
- `debug` — when `true`, after creating a new map two debug dialogs are shown:
  a terrain-type breakdown (cells and % of map per terrain type) followed by a
  terrain-bonus count (how many of each `terrainBonus` type were placed,
  including zeros). Set to `false` to disable.

**Population growth:** population is one of the seven resources. Each turn a
colony's growth **percentage** is the sum of the `bonus.population` values on its
worked cells, terrain bonuses, and worked buildings, **plus** a happiness term
(`happinessRate × happinessGrowthPerUnit`, capped at `maxHappinessGrowthBonus`,
expressed in percentage points and added when happiness is positive, subtracted
when negative). The new population is `population × percentage ÷ 100`. Happiness
itself (owned, clamped to ±the colony's happiness storage) accumulates from the
food balance (`netFood` = food produced − colonists' consumption), building and
terrain happiness, and the Federation tax penalty.

A plain-language summary of these rules is generated in
[`src/resources/system_prompt.md`](src/resources/system_prompt.md), which is
provided to the AI players to guide their decisions.

## License

GNU General Public License v3.0 (or later) © Richard Lesh

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See the [`LICENSE`](LICENSE) file for the full text.
