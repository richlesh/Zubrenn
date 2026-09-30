# Zubrenn — AI Player Guide

You are an alien species competing on a hex-grid world. Each turn you decide
which tiles your colonies work, what buildings to construct, and when to found
new colonies. This document summarizes the rules exactly as configured in
`config.json`. Numbers here are the current configuration and may change if the
config changes.

**Goal of the game:** build the largest civilization you can — grow your total
population across as many colonies as possible. Expand by growing existing
colonies and by founding new ones once a colony is large enough.

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
  +1 energy, +1 wealth** on top of that cell's terrain production.
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

## Founding new colonies

Once a colony's population exceeds **`foundColonyMinPopulation`** (3,000) you can
found a new colony from it:

- It costs the **Biodome build cost** (paid from the host colony's storage) and
  transfers **`foundColonyPopulationTransfer`** (1,000) colonists out of the host.
- The new biodome travels overland to the target cell. **Travel time** =
  Biodome `buildCost.turns` + `ceil(pathCost / biodomeMovementPerYear)` turns
  (`biodomeMovementPerYear` = 12). While in transit it produces nothing; on
  arrival it becomes a colony and gains the 1,000 colonists.
- **Movement / path cost:** each cell entered costs its terrain
  `movement[0]` (unimproved) points; crossing a river segment adds
  `riverCrossingMovementCost` (2). (A tile's `movement` array is
  `[unimproved, road, sea (or river), monorail, air]`; only the unimproved cost
  is used today.) **Deep sea is impassable**, and **frozen
  cells above `impassableFrozenAltitude` (5,000 m) are impassable**. If you own
  a **Dock**, your paths may also cross **shallow-sea** tiles (sea adjacent to
  land), letting you reach islands and cross straits.
- The target must be habitable land (2–7 or low frozen), empty, and at least
  `minColonyDistance` (20) cells from every existing colony. (You settle on land;
  you may cross shallow sea to get there if you have a Dock.)

**Launch action (LLM plan):** include a `launch` array in your plan:

```
"launch": [ { "from": [hostX, hostY], "to": [targetX, targetY], "name": "Optional" } ]
```

Found new colonies whenever you can afford to — more colonies means a larger
civilization.

## Working tiles

- Each worked cell represents **1,000 workers** and yields that cell's terrain
  Food/Material (plus the water bonus, plus any building on it).
- The Biodome cell is always worked. You may work up to
  **floor(population / 1,000)** additional cells within the zone of control.
- **Happiness** is driven by your food balance: a colony's food **surplus**
  raises happiness, a food **shortfall** lowers it (see growth section).

## Buildings

Build within your zone of control; each costs resources and takes time to
become operational (it produces nothing until finished). **A building only
produces its bonus (and only pays its upkeep) when its cell is worked** — an
idle building on an unworked cell does nothing but still provides storage.

**Prerequisites:** a building type can only be built at a colony once its
`prerequisiteBuildings` already exist there. Currently: Farm, Solar Panel and
Dock require a Biodome; the Factory requires a Biodome **and** a Solar Panel.

**Removing a building** (Remove Improvement) costs `removeImprovementCost`
(Energy + Food from the colony) and takes `removeImprovementCost.turns` to
complete; the building stops producing immediately and disappears when the
timer expires.

**Removing a canal:** right-clicking a built canal border offers **Remove
Canal**, which costs `removeCanalCost` (Energy + Food, paid by a colony
controlling either adjacent cell). The border stops being a canal immediately;
each adjacent cell stops counting as a river cell unless an original river or
another canal still touches it.

In every cost block, `turns` is the build/removal time, not a payable
resource.

**Docks and the sea:** a **Dock** (type 5) is built on a **shallow-sea** tile
(a sea tile edge-adjacent to land) inside a colony's zone of control. Building a
Dock (1) **opens all shallow-sea tiles in the colony to being worked** (they
join the control area), and (2) **lets your colony-launch travel paths cross
shallow sea**. Without a Dock, sea tiles are impassable and unworkable; deep sea
(not adjacent to land) is always impassable.

| Building | Build cost | Build turns | Per-year upkeep | Prerequisites | Effect (when worked) |
| --- | --- | --- | --- | --- | --- |
| Biodome (colony) | 3 material, 5 wealth | 2 | none | — | +1 food, +1 material, +1 energy, +1 wealth on its cell |
| Farm | 3 material, 2 energy, 2 wealth | 1 | 1 material, 1 energy, 0.5 wealth | Biodome | +3 food, +0.25% growth, +1 wealth (net +0.5) |
| Solar Panel | 2 material, 2 energy, 2 wealth | 1 | 0.5 wealth | Biodome | +5 energy |
| Factory | 5 material, 5 energy, 5 wealth | 3 | 2 material, 4 energy, 1 wealth | Biodome, Solar Panel | +5 material (net +3), −0.25% growth, +1 wealth (net 0) |
| Dock | 1 material, 1 energy, 1 wealth | 2 | 1 energy, 1 wealth | Biodome | +1 food, +1 material, +1 wealth; on a shallow-sea tile; opens shallow sea to working and travel |

### Storage capacity

Every building also provides **storage** that caps how much a colony can hold.
A colony's cap for each resource is the **sum of the storage** its buildings
provide (storage is per-colony for now):

| Building | Food | Material | Energy | Wealth | Happiness |
| --- | --- | --- | --- | --- | --- |
| Biodome | 100 | 100 | 100 | 100 | 100 |
| Farm | 500 | 0 | 100 | 0 | 0 |
| Solar Panel | 0 | 0 | 500 | 0 | 0 |
| Factory | 0 | 500 | 200 | 0 | 0 |
| Dock | 100 | 100 | 0 | 0 | 0 |

Stored Food/Material/Energy/Wealth are clamped to these totals; anything
produced beyond the cap is lost. **Happiness** is clamped to the symmetric band
**±(sum of happiness storage)** — so with only a Biodome a colony's happiness
ranges from −100 to +100. Build more storage to hold larger stockpiles.

## Resources (per year)

Your colonies accumulate four resources (all tracked as running totals):

- **Material** — 1,000 metric tonnes per unit. Used to build.
- **Food** — 1,000 metric tonnes per unit. Feeds colonists.
- **Energy** — 1 GW·hr per unit. Farms/Factories consume it; Solar Panels
  produce it.
- **Wealth** — 1,000,000 credits per unit. Used to build.

**Per-colony yearly budget.** Each colony (not the player as a whole) keeps its
own stored resources. Each year it computes, from its **worked** cells only:

- **Production** = terrain + worked-building bonuses (+ derived wealth: 10% of
  surplus food + 10% of material produced).
- **Needs** = population food consumption + worked-building upkeep
  (`costPerYear`).
- **Net = production − needs**, per resource. If net is positive the **excess is
  stored** (up to the storage cap); if net is negative the **shortfall is drawn
  from storage**.

**Connected colonies share resources.** If a colony's own storage can't cover a
shortfall, it draws the difference from other colonies **you own that are
connected to it** — either by a **road/monorail path** between their biodomes, or
by a **connected river/canal path** touching a corner of each colony. It pulls
from whichever connected colony currently **stores the most** of that resource.
Only if no connected colony can cover it does the colony go over budget. So
linking colonies with roads, monorails, or canals lets a rich colony prop up a
struggling neighbour instead of forcing it to idle buildings.

If storage for any resource would drop **below 0**, the colony is **over
budget** and cannot sustain its worked buildings. Reduce your yearly needs by
**idling buildings** — deselect (unwork) their cells so they stop consuming
upkeep — until the budget balances. (Idle buildings still provide storage but
produce nothing.)

## Population growth each year

Growth is driven by **stored happiness**, which each colony accumulates over
time and which may go negative.

For each colony, per year:

1. **Food balance.** Food consumption = `population/1000 × 1` food per year
   (`foodPerColonistUnit`). `netFood = food produced − consumption`.
2. **Happiness rate** = `netFood` (surplus is positive, shortfall negative) plus
   any building happiness bonuses.
3. **Stored happiness** += happiness rate, then **clamped** to
   **±(sum of building happiness storage)** for that colony.
4. **Growth direction** follows the **sign** of stored happiness:
   - Stored happiness **≥ 0** → the colony **grows**.
   - Stored happiness **< 0** → the population **declines**.
5. **Growth rate magnitude** = base growth (**1% per year**, Biodome
   `growthRate`) + a happiness component + building growth modifiers (Farm
   +0.25%, Factory −0.25%). The happiness component is
   `happinessRate × 0.001` (`happinessGrowthPerUnit`), **capped in magnitude at
   1%** (`maxHappinessGrowthBonus`).
   - When declining, the rate is the negative of (base + capped happiness
     component), plus building modifiers.

In short: keep each colony **well-fed** (food surplus) to build up positive
stored happiness and grow; a lasting food **shortfall** drives stored happiness
negative and the colony shrinks until its population fits its food supply.

## Strategy priorities

1. Found colonies on food-rich, water-adjacent grassland/hills, ≥20 cells from
   rivals.
2. Keep enough worked food tiles (or Farms) so no colony starves.
3. Work high-material tiles (hills, mountains) once food is secure, to fund
   building.
4. Build Solar Panels before Farms/Factories so you have the energy they need
   (the Factory also *requires* a Solar Panel as a prerequisite).
5. **Work the cells your buildings sit on** — an unworked building produces
   nothing. Only keep buildings worked while their upkeep fits the colony's
   yearly budget; if a resource's storage hits 0, **idle** (unwork) a building
   to rebalance.
6. Grow population to expand your zone of control, then work the newly available
   tiles.
7. Maintain a **food surplus** in every colony: surplus builds positive stored
   happiness and drives growth, while a shortfall makes happiness negative and
   shrinks the colony. Add Farms or work more food tiles before expanding.
8. Build **storage** (Farms, Solar Panels, Factories) so surplus production
   isn't wasted against the cap.
9. **Found new colonies** from any colony above 3,000 population when you can
   afford it — spreading to more colonies is the fastest way to grow the total
   civilization, which is how you win.
10. **Build Docks** at coastal colonies to work productive shallow-sea tiles and
    to open sea routes — a Dock lets you settle across straits and on islands
    you otherwise couldn't reach.
