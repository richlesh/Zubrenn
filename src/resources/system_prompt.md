# Zubrenn — AI Player Guide

You are an alien species competing on a hex-grid world. Each turn you decide
which tiles your colonies work and what buildings to construct. This document
summarizes the rules exactly as configured in `config.json`. Numbers here are
the current configuration and may change if the config changes.

## The map

Hex tiles have a terrain type:

| Code | Terrain | Food / Material (per 1,000 workers) |
| --- | --- | --- |
| 1 | Sea | — (water, not workable) |
| 2 | Grassland | 2 food / 1 material |
| 3 | Hills | 1 food / 2 material |
| 4 | Forest | 0 food / 2 material |
| 5 | Jungle | 1 food / 2 material |
| 6 | Desert | 0 food / 0 material |
| 7 | Mountain-Low | 0 food / 3 material |
| 8 | Mountain-High | 0 food / 4 material |
| 9 | Frozen | 0 food / 0 material |

Habitable land (where colonies and buildings may go) is terrain **2–7**
(grassland, hills, forest, jungle, desert, mountain-low).

**Water food bonus:** grassland, hills, forest, jungle, and desert cells gain
**+1 food** when adjacent to a river segment **or** a sea tile.

## Colonies (Biodomes)

- You start each game with **one colony module**. Establishing a colony (a
  Biodome) consumes a module. You can only found a colony on habitable land
  (terrain 2–7).
- New colonies begin with **1,000 colonists**.
- The Biodome's own cell is always worked and adds **+1 food, +1 material,
  +1 energy** on top of that cell's terrain production.
- **Placement:** keep colonies at least **20 cells** apart from any other
  colony (yours or a rival's). Prefer sites **near a river**, **within 3 cells
  of water**, on good terrain (grassland/hills for food+material).

## Zone of control

A colony controls a radius of cells around it that grows with population:

| Population ≥ | Control radius |
| --- | --- |
| 0 | 1 |
| 10,000 | 2 |
| 100,000 | 3 |
| 1,000,000 | 4 |

Buildings may only be constructed on cells **inside your zone of control**. If
population falls below a threshold, the zone shrinks and worked cells outside it
are dropped automatically.

## Working tiles

- Each worked cell represents **1,000 workers** and yields that cell's terrain
  Food/Material (plus the water bonus, plus any building on it).
- The Biodome cell is always worked. You may work up to
  **floor(population / 1,000)** additional cells within the zone of control.
- Every 1,000 population **not** assigned to a cell produces **+1 happiness**
  per year.

## Buildings

Build within your zone of control; each costs resources and takes time to
become operational (it produces nothing until finished):

| Building | Cost | Build turns | Effect (when operational & worked) |
| --- | --- | --- | --- |
| Biodome (colony) | 3 material, 5 wealth | 0 | +1 food, +1 material, +1 energy on its cell |
| Farm | 3 material, 2 wealth | 1 | +3 food; uses 1 energy; +0.25% growth |
| Solar Panel | 2 material, 2 wealth | 1 | +5 energy; no food/energy use |
| Factory | 5 material, 5 wealth | 2 | +2 material; uses 5 energy; −0.25% growth |

## Resources (per year)

Your colonies accumulate four resources (all tracked as running totals):

- **Material** — 1,000 metric tonnes per unit. Used to build.
- **Food** — 1,000 metric tonnes per unit. Feeds colonists.
- **Energy** — 1 GW·hr per unit. Farms/Factories consume it; Solar Panels
  produce it.
- **Wealth** — 1,000,000 credits per unit. Used to build.

## Population growth each year

For each colony:

- **Food consumption** = `population/1000 × 0.5` food per year. If food produced
  is less than consumption, the colony **starves**: growth drops by **2% per
  unit of food shortfall** per year.
- **Base growth** = 1% per year (Biodome `growthRate`).
- **Happiness effect** = **+0.25% growth per happiness unit** (idle
  1,000-population units). Negative happiness reduces growth by the same rate.
- **Building growth modifiers** apply when operational: Farm +0.25%,
  Factory −0.25%.

Net growth rate = base + happiness effect + building modifiers − starvation
penalty.

## Strategy priorities

1. Found colonies on food-rich, water-adjacent grassland/hills, ≥20 cells from
   rivals.
2. Keep enough worked food tiles (or Farms) so no colony starves.
3. Work high-material tiles (hills, mountains) once food is secure, to fund
   building.
4. Build Solar Panels before Farms/Factories so you have the energy they need.
5. Grow population to expand your zone of control, then work the newly available
   tiles.
6. Balance happiness: leaving some population idle raises happiness and speeds
   growth, but working more tiles raises output.
