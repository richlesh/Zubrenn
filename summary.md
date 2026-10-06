# Zubrenn — Building Types Matrix

Per-resource breakdown of each building type in
[`src/config.json`](src/config.json), split into three tables: **Build Cost**,
**Annual Cost** (upkeep), and **Production** (per-year bonus when worked).

Resource columns: **E** Energy · **F** Food · **M** Material · **G** Goods ·
**¤** Wealth · **W** Water · **H** Happiness · **P** Population. A blank cell
means the resource is zero or absent (explicit `0` values in `config.json` are
shown blank too). Negative values are penalties.

## 1. Build Cost

One-time cost to construct. **Turns** is the build time (not a payable resource).

| #   | Building        | Turns | E   | F   | M   | G   | ¤   | W    | H   | P   |
| --- | --------------- | :---: | :-: | :-: | :-: | :-: | :-: | :--: | :-: | :-: |
| 1   | Biodome         | 3     |     |     | 200 |     | 100 | 2    |     |     |
| 2   | Farm            | 1     | 10  |     | 20  |     | 10  | 0.25 |     |     |
| 3   | Solar Panel     | 1     | 50  |     | 20  |     | 28  | 0.25 |     |     |
| 4   | Factory         | 3     | 250 |     | 75  |     | 150 | 3    |     |     |
| 5   | Dock            | 1     | 5   |     | 10  |     | 5   | 0.25 |     |     |
| 6   | Air Field       | 3     | 20  |     | 50  | 15  | 50  | 3    |     |     |
| 7   | Barracks        | 2     | 5   |     | 10  |     | 10  | 1    |     |     |
| 8   | Grainery        | 2     | 5   |     | 10  |     | 5   | 1    |     |     |
| 9   | Warehouse       | 2     | 10  |     | 25  |     | 8   | 1    |     |     |
| 10  | Bank            | 1     | 5   |     | 10  |     | 20  | 0.5  |     |     |
| 11  | CAES            | 3     | 15  |     | 25  | 10  | 25  | 1    |     |     |
| 12  | WTP             | 4     | 20  |     | 30  | 10  | 30  | 2    |     |     |
| 13  | Desalination    | 5     | 25  |     | 30  |     | 40  | 2    |     |     |
| 14  | Spaceport       | 3     | 30  |     | 50  | 25  | 75  | 3    |     |     |
| 15  | Drone Base      | 1     | 5   |     | 10  | 10  | 50  | 1    |     |     |
| 16  | Materials Depot | 2     | 10  |     | 25  |     | 8   | 1    |     |     |

## 2. Annual Cost

Per-year upkeep, subtracted from the building's output.

| #   | Building        | E   | F   | M   | G   | ¤   | W   | H   | P   |
| --- | --------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1   | Biodome         |     |     |     |     |     |     |     |     |
| 2   | Farm            | 0.2 |     | 5   |     | 5   | 5   |     |     |
| 3   | Solar Panel     |     |     |     |     | 1   |     |     |     |
| 4   | Factory         | 300 |     | 250 |     | 15  | 1   |     |     |
| 5   | Dock            | 5   |     |     |     | 3   | 0.1 |     |     |
| 6   | Air Field       | 50  |     |     | 10  | 10  | 0.2 |     |     |
| 7   | Barracks        | 10  |     |     | 5   | 5   |     |     |     |
| 8   | Granary        | 2   |     |     |     | 0.5 |     |     |     |
| 9   | Warehouse       | 5   |     |     |     | 5   |     |     |     |
| 10  | Bank            | 5   |     |     |     | 2   |     |     |     |
| 11  | CAES            | 20  |     |     | 1   | 2   |     |     |     |
| 12  | WTP             | 30  |     | 4   | 2   | 2   |     |     |     |
| 13  | Desalination    | 50  |     | 30  | 4   | 5   |     |     |     |
| 14  | Spaceport       | 100 |     | 10  | 20  | 20  | 0.5 |     |     |
| 15  | Drone Base      | 15  |     |     | 5   | 3   |     |     |     |
| 16  | Materials Depot | 5   |     |     |     | 5   |     |     |     |

## 3. Production (per year)

Bonus output applied only when the building's cell is worked. The **Storage**
column lists each resource this building can hold and its capacity.

| #   | Building        | E   | F   | M   | G   | ¤   | W   | H     | P   | Storage                                                    |
| --- | --------------- | :-: | :-: | :-: | :-: | :-: | :-: | :---: | :-: | ---------------------------------------------------------- |
| 1   | Biodome         | 50  | 5   | 30  | 30  | 50  | 5   | 0.5   | 1   | E: 75, F: 10, G: 250, M: 250, W: 5, ¤: 250, H: 25, P: 6000 |
| 2   | Farm            |     | 25  |     |     | 15  |     |       |     | F: 25                                                      |
| 3   | Solar Panel     | 500 |     |     |     |     |     |       |     | E: 500                                                     |
| 4   | Factory         |     |     |     | 200 | 25  |     | −0.25 |     | E: 25, G: 500, M: 500                                      |
| 5   | Dock            |     | 5   |     |     | 5   |     |       |     | F: 5                                                       |
| 6   | Air Field       |     |     |     |     | 10  |     | 0.25  |     | E: 20, F: 50, G: 100                                       |
| 7   | Barracks        |     |     |     |     |     |     |       |     | F: 5, G: 10                                                |
| 8   | Grainery        |     |     |     |     |     |     |       |     | F: 100                                                     |
| 9   | Warehouse       |     |     |     |     |     |     |       |     | G: 250                                                     |
| 10  | Bank            |     |     |     |     | 15  |     | 0.25  |     | ¤: 250                                                     |
| 11  | CAES            |     |     |     |     |     |     |       |     | E: 500                                                     |
| 12  | WTP             |     |     |     |     |     | 50  |       |     | W: 100                                                     |
| 13  | Desalination    |     |     |     |     |     | 40  |       |     | W: 100                                                     |
| 14  | Spaceport       |     |     |     |     | 15  |     | 0.25  |     | E: 20, F: 50, G: 100                                       |
| 15  | Drone Base      |     |     |     |     |     |     |       |     |                                                            |
| 16  | Materials Depot |     |     |     |     |     |     |       |     | M: 250                                                     |

**Notes**

- Resource abbreviations: **E** Energy · **F** Food · **M** Material ·
  **G** Goods · **¤** Wealth · **W** Water · **H** Happiness · **P** Population.
- A blank cell means the resource is zero or absent for that cost/bonus; explicit
  `0` values in `config.json` are shown blank too.
- Negative Production values are penalties, e.g. the Factory's −0.25 Happiness
  and −0.25 Population.
- Storage lists only non-zero capacities, in the order they appear in config; a
  dash (—) means the building stores nothing.

## 4. Terrain Types — Production (per year)

Base per-resource yield of each terrain type (`terrainTypes[*].bonus`, per 1,000
workers). Negative values are penalties. Terrain `bonus` objects only ever carry
Food / Material / Water / Energy / Wealth / Happiness.

| Code | Terrain       | E   | F   | M   | ¤   | W   | H    |
| :--: | ------------- | :-: | :-: | :-: | :-: | :-: | :--: |
| 1    | Sea           |     | 2.5 |     |     |     |      |
| 2    | Grassland     |     | 10  | 5   |     |     |      |
| 3    | Hills         |     | 5   | 15  |     |     |      |
| 4    | Forest        |     | 5   | 15  |     |     |      |
| 5    | Jungle        |     | 5   | 10  |     | 0.5 |      |
| 6    | Desert        |     |     |     |     |     |      |
| 7    | Mountain-Low  |     |     | 30  |     |     |      |
| 8    | Mountain-High |     |     | 40  |     |     |      |
| 9    | Frozen        |     |     |     |     |     |      |
| 10   | Plains        |     | 5   | 5   |     |     |      |
| 11   | Wetlands      |     |     | 5   |     | 0.5 | 0.25 |

## 5. Terrain Bonuses — Production (per year)

Special resource deposits (`terrainBonus[*].bonus`). Many yields are **ranges**
(a random amount within the range is rolled per deposit). The **Abund.** column
is the deposit's relative placement abundancy. Grouped by their primary resource
(as commented in `config.json`).

| Deposit                      | E       | F     | M     | ¤      | W   | H    | Abund. |
| ---------------------------- | :-----: | :---: | :---: | :----: | :-: | :--: | :----: |
| Food                         |         |       |       |        |     |      |        |
| Myco-Tower Grove             |         | 5-10  |       |        | 0.2 |      | 5      |
| Microalgae Lattice           |         | 10-25 |       |        |     |      | 5      |
| Substrate Slime              |         | 10-20 |       |        | 0.5 |      | 5      |
| Glacial Bloom                |         | 5-10  |       |        |     |      | 0.5    |
| Chemosynthetic Vent Colonies | 5       | 5-10  |       |        |     |      | 1      |
| Veyra Pods                   |         | 15-30 |       |        |     |      | 2      |
| Cloudkelp Beds               |         | 10-25 |       |        |     |      | 3      |
| Morrowback Herds             |         | 20-40 |       |        |     |      | 2      |
| Bugalo Grazing Range         |         | 20-40 |       | 5      |     | 0.25 | 2      |
| Thousandseed Basin           |         | 10-20 |       |        |     |      | 2      |
| Material                     |         |       |       |        |     |      |        |
| Ferric Strata Veins          |         |       | 25-50 |        |     |      | 1      |
| Kinetite Crystals            |         |       | 25-50 | 5-10   |     |      | 0.5    |
| Fossilized Chitin Reefs      |         |       | 10-30 | 5-10   |     |      | 1      |
| Aero-Silk Nests              |         |       | 10–30 | 5-10   |     |      | 1      |
| Starfall Alloy Crater        |         |       | 10–30 | 5-10   |     |      | 0.25   |
| Threadstone Seam             |         |       | 50-75 |        |     |      | 2      |
| Hexabark Grove               |         |       | 25-50 |        |     |      | 2      |
| Gravalloy Veins              |         |       | 50-75 | 5-10   |     |      | 2      |
| Titanlace Deposit            |         |       | 30–50 | 10-20  |     |      | 2      |
| Energy                       |         |       |       |        |     |      |        |
| Tidal Dynamo Basin           | 250–750 |       |       |        |     |      | 0.25   |
| Geothermal Plume             | 250–750 |       |       |        |     |      | 1      |
| Sunshard Flats               | 100-300 |       |       |        |     |      | 2      |
| Pyrogel Pool                 | 100-300 |       |       |        |     |      | 2      |
| Aurora Spires                | 100-300 |       |       |        |     |      | 1      |
| Wealth                       |         |       |       |        |     |      |        |
| Vaelis Resin                 |         |       |       | 25-50  |     | 0.25 | 1      |
| Lightningfly Venom           |         |       |       | 40-80  |     | 0.25 | 1      |
| Memory Opals                 |         |       |       | 25-50  |     | 0.25 | 3      |
| Starveil Filaments           |         |       |       | 40-80  |     | 0.25 | 1      |
| Crownfire Geodes             |         |       |       | 25-50  |     | 0.25 | 1      |
| Happiness                    |         |       |       |        |     |      |        |
| Aurelian Sky Mirrors         |         |       |       | 10-30  |     | 0.25 | 0.1    |
| Chorus Gardens               |         |       |       | 10-30  |     | 0.25 | 1      |
| Echo Monolith                |         |       |       | 50-100 |     | 0.25 | 0.1    |
| Jaba Grove                   | 100–300 | 5-10  |       |        |     | 0.25 | 0.25   |
| Dreamblossom Field           |         |       |       | 10-50  |     | 0.25 | 1      |
| Dancing Veil Falls           | 100–300 |       |       | 40-80  |     | 0.25 | 1      |

## 6. Unit Cost (per year)

Per-unit yearly resource consumption (`unitCosts`). **Size** is `unitSize`
(consumption is per that many units; where absent, cost is per single unit).
Only **population** is used by the economy today — the military entries are
scaffolding for a future combat system and are not yet read by the code.

| Unit       | Size | E   | F   | G   | ¤   | W   |
| ---------- | :--: | :-: | :-: | :-: | :-: | :-: |
| Population | 1000 | 5   | 1   | 10  | 8   | 0.2 |
| Infantry   | 1000 | 6   | 1   | 10  | 10  | 0.2 |
| Tank       | —    | 2   | 2   | 2   | 2   | 0.1 |
| Fighter    | —    | 1   | 1   | 1   | 1   | 0.1 |
| Bomber     | —    | 2   | 2   | 2   | 2   | 0.1 |
| Submarine  | —    | 1   | 1   | 1   | 1   | 0.1 |
| Carrier    | —    | 2   | 2   | 2   | 2   | 0.1 |
