
## Military

A colony's military is made up of **units** — battalions, squadrons, and fleets
recruited from the colony's own population at a **Barracks**, **Army Base**,
**Joint Base**, or **Naval Base**. Units are stationed in colonies, can be moved
(rebased) between your colonies, and are used to **attack** enemy colonies in a
**strike force**.

Each unit has a **manpower strength** (its current size) that fills toward its
maximum (its *unit size*) as the home building recruits colonists into it. A
unit's fighting power scales with how full it is: a half‑manned unit fights at
half strength and has half its hit points.

### Bases

Bases are where military units are trained and military assets are built.  Units can be repaired but only by the home base that built the unit originally.

#### Barracks

<img align="right" width="128" src="src/resources/buildings/128/barracks.png">

The Barracks trains military battalions for defense and offense, drawing recruits from the colony's own population. It requires a **Factory** before it can be built. A modest build with light upkeep, it also lifts morale a little. Each Barracks supports and rebuilds a single battalion, so a would‑be military power raises them across its colonies.
 
#### Army Base

<img align="right" width="128" src="src/resources/buildings/128/army_base.png">

The Army Base is the Barracks writ large — a full garrison that trains and fields several battalions at once. It is built as an **upgrade of an existing Barracks**, raised in its place, and still counts as a Barracks for anything that depends on one. It requires a **Solar Farm**, a **Farm**, and a **Factory** in the colony, a transport link to another of your colonies, and a colony population of at least 8,000. Where a Barracks supports a single infantry battalion, an Army Base fields **three infantry battalions and one armored (tank) battalion**, each recruited from the colony's population and rebuilt here when destroyed. A substantial build with heavier upkeep, it is the backbone of any colony meant to project real military force.

#### Joint Base

<img align="right" width="128" src="src/resources/buildings/128/joint_base.png">

The Joint Base is the Army Base elevated to a combined‑arms command — a sprawling installation that trains ground and air forces side by side. It is built as an **upgrade of an existing Army Base**, raised in its place, and still counts as a Barracks (and Army Base) for anything that depends on one. It is a top‑tier capstone, requiring a **Solar Farm**, an **Agridome**, a **Megafactory**, and a **Bank** in the colony, a transport link to another of your colonies, and a colony population of at least 12,000. It fields the largest garrison in the game — **five infantry battalions, three armored (tank) battalions, and two fighter squadrons** — each recruited from the colony's population and rebuilt here when destroyed. A major build with substantial upkeep, it is the heart of a true military superpower.

#### Naval Shipyard

<img align="right" width="128" src="src/resources/buildings/128/naval_shipyard.png">

The Naval Shipyard is the colony's gateway to the sea — the **only** building that can construct **Escort** groups and **Carrier** battle groups. It is raised on a shallow‑sea tile within a colony that already has a **Port**, and is a demanding late‑game build: it also requires a **Solar Farm**, an **Agridome**, a **Nanofactory**, and a **Bank**, a transport link to another of your colonies, and a colony population of at least 15,000, with a heavy, broad upkeep to keep its slipways running. It builds up to two Escorts and one Carrier, drawn from the colony's population. A shipyard is also each naval unit's **home base**: a damaged ship is **repaired** (rebuilt toward full strength) only when it returns to the shipyard that built it. Escorts and Carriers may be **stationed at any colony with a Port**, but they can only be constructed and repaired at a Naval Shipyard.
 
### Unit Types

Attack, Defense, and HP are the unit's values at **full** strength; a unit at
*s / max* manpower fights at that fraction. **Attack** is damage dealt,
**Defense** is damage mitigated per hit, and **HP** is how much damage the unit
can take before it is destroyed. **Size** is the manpower a full unit holds.
**Speed** sets travel time (`ceil(path cost / speed)` turns). **Range** limits
how far air and naval units can strike. **Based at** is where the unit may be
stationed.

| Unit | Size | Attack | Defense | HP | Speed | Range | Based at |
|------|-----:|-------:|--------:|---:|------:|------:|----------|
| Infantry | 1,000 | 1 | 1 | 5 | 8 | — | Any colony |
| Armored (Tank) | 500 | 3 | 3 | 15 | 2 | — | Any colony |
| Fighter | 300 | 3 | 3 | 6 | 5 | 20 | Colony with an **Air Field** or **Airport** |
| Bomber | 300 | 5 | 1 | 4 | 4 | 40 | Colony with an **Airport** |
| Escort | 1,250 | 4 | 7 | 20 | 2 | — | Colony with a **Port** |
| Carrier | 6,000 | 12 | 5 | 25 | 3 | 30 | Colony with a **Port** |

<img align="right" width="128" src="src/resources/units/infantry.png">

- **Infantry** — a 1,000‑strong rifle battalion: dismounted troops armed with
  small arms, portable missiles, and light support weapons. Cheap, quick to
  raise, and the fastest ground unit on land thanks to the hovercraft they
  employ for rapid deployment. They are individually weak but rely on numbers —
  a swarm of battalions can overwhelm what no single one could. Crucially,
  Infantry are a **land** unit, and only land units (Infantry and Armored) can
  march in and **occupy or capture** a colony; air and naval forces can smash
  defenses but never hold ground. They can be stationed in **any** colony. No
  stealth — they advance in the open and are seen coming.

<img align="right" width="128" src="src/resources/units/tank.png">

- **Armored** — a 50‑tank battalion of heavy main‑battle tanks and fighting
  vehicles, with powerful cannon and reactive armor. Many times the attack and
  defense strength of Infantry, they win almost any straight ground fight — but
  their weight makes them the slowest unit in the game, so they lumber to the
  front. As a **land** unit they can occupy and capture colonies, making them
  the ideal spearhead: send Armored to break the defense and Infantry to
  garrison what you take. Stationable in **any** colony.

<img align="right" width="128" src="src/resources/units/fighter.png">

- **Fighter** — a squadron of fast air‑superiority stealth jets armed with
  cannon and air‑to‑air and air‑to‑ground missiles. Balanced in attack and
  defense and quick in the air, they strike hard for their size but are fragile
  if caught on the ground. Fighters must be based at a colony with an **Air
  Field or Airport**, and can only join a strike against a target within their
  **range of 20** of the staging colony — a defensive and short‑reach offensive
  weapon. Being aircraft, they overfly terrain and cannot themselves hold
  ground.

<img align="right" width="128" src="src/resources/units/bomber.png">

- **Bomber** — a squadron of heavy strategic stealth bombers carrying stand‑off
  missiles and precision ordnance. They hit the hardest of any air unit but are
  lightly protected — devastating on the attack, vulnerable if intercepted. With
  the **longest air range** they can reach deep targets no fighter could, but
  they need the larger facilities of an **Airport** to base and arm at. Use them
  to crack a colony's defensive systems before your land force arrives.

<img align="right" width="128" src="src/resources/units/escort.png">

- **Escort** — a naval task group of stealth cruisers, destroyers, a submarine,
  and a supply ship, bristling with anti‑ship, anti‑air, and anti‑submarine
  systems. Built for survival with a modest attack, the escort's role is **sea
  control**: its submarine element gives it a measure of **stealth and
  screening** that makes it the counter to enemy fleets. Escorts must be based
  at a **Port** and fight only at sea — they may attack **only** a target
  defended by enemy naval units (Escorts or Carriers), hunting fleets rather
  than bombarding the shore. They move slowly.

<img align="right" width="128" src="src/resources/units/carrier.png">

- **Carrier** — a 100‑aircraft carrier battle group: a flattop with its embarked
  air wing (around five squadrons) that carries the heaviest punch of any unit
  thanks to its aircraft reaching far beyond the hull, though the carrier itself
  is only moderately armored and depends on its screen for protection. Based
  only at a **Port**, it projects power from the sea onto the land: it can strike
  any coastal colony within its **range of 30** of the nearest coast it can
  reach by sea from its home port — the one naval unit able to assault a shore.
  Being a fleet, it cannot occupy ground; pair it with a land force to take what
  it batters.

### Upkeep

Each built unit draws a yearly **upkeep** (Food/Goods/Energy/Water/Wealth), paid
by its **home colony**, scaled by how full it is (a half‑strength unit pays half
upkeep). If the home colony can't cover it, the shortfall is borrowed from the
**Federation** and connected colonies like any other colony need.

### Defensive Systems

Defensive systems protect a colony from enemy strike forces. Each has its own
**HP** (how much damage it can take before it is destroyed) and a **Defense**
rating that mitigates each incoming hit. They are **purely defensive** — they
soak up and reduce an attacker's blows but deal no damage back. When a defensive
system's HP is beaten down to zero it is destroyed and removed; HP and defense
are restored to full each turn, so a colony that survives an assault stands
ready again next year. All require a **Factory** first and may be built on any
land within a colony's control. Defensive systems are classified as buildings in
Zubrenn, built per colony and remaining in the colony where they originated. A
colony's defenses stack: all of its defensive systems **plus** any stationed
units defend it together.

#### Missile Battery

<img align="right" width="128" src="src/resources/buildings/128/missile_battery.png">

The Missile Battery is the entry‑level colony defense — racks of guided
interceptors that pepper an incoming strike force. Cheap and quick to raise with
light upkeep, it needs only a modest colony population to field. With a small HP
pool and little mitigation, it blunts a light raid or buys time while heavier
defenses or a relief force are brought up.

#### Laser Battery

<img align="right" width="128" src="src/resources/buildings/128/laser_battery.png">

The Laser Battery trades missiles for directed‑energy weapons — banks of
high‑powered lasers that burn through attackers at the speed of light. A little
pricier than the Missile Battery and hungrier for power, and requiring a
somewhat larger colony, it is tougher and deflects a little more of each hit. It
is the natural step up for a colony expecting more than a token assault.

#### Electro-Magnetic Shield

<img align="right" width="128" src="src/resources/buildings/128/shield.png">

The Electro‑Magnetic Shield throws a crackling energy barrier over the colony,
soaking up tremendous punishment before it fails. A major build with a heavy,
continuous power draw and a sizable population requirement, it has a large HP
pool — making a shielded colony a hard target that an attacker must grind down
before anything behind it can be touched.

#### Plasma Bubble

<img align="right" width="128" src="src/resources/buildings/128/plasma_bubble.png">

The Plasma Bubble is the ultimate colony defense — a seething dome of contained
plasma that all but encases the settlement. It is built as an **upgrade of an
existing Electro‑Magnetic Shield**, raised in its place, and demands a large,
mature colony and a steep, ongoing investment of power and wealth to sustain. In
return it has an enormous HP pool and the best mitigation of any system, enough
to turn back all but the most overwhelming strike force. For a frontier capital
or a prized industrial world, the Plasma Bubble is the last word in protection.

### Intelligence Gathering

What you know about rival species depends on your **intelligence coverage**. Without a Satellite Network, you gather intel only within sight of your **Biodomes** and **Drone Bases**: you can inspect a rival colony (double‑click it for a read‑only details view) and see a species' cumulative statistics in the **Rankings** screen only while at least one of that species' colonies falls within that range. A species none of whose colonies you can see shows blank rankings.  With a Satellite Network, you can see the entire planet and gather intelligence on any species in the game.

#### Drone Base

<img align="right" width="128" src="src/resources/buildings/128/drone_base.png">

The Drone Base is a self‑contained forward reconnaissance outpost that can be placed on almost any explored cell, even far outside a colony's borders, peeling back the fog of war over a wide area and giving real‑time intelligence on neighboring colonies. Powered by its own solar panels and linked wirelessly to the nearest colony, it is funded — in both construction and upkeep — by the Federation rather than any single colony. Deployment relies on route planning: the base travels overland from the nearest colony, so rougher, farther sites take longer to come online, with roads and monorails speeding the journey; it can cross shallow sea only when a Dock is present. It produces nothing and stores nothing — its sole purpose is sight.

#### Satellite Network

<img align="right" width="128" src="src/resources/buildings/128/satellite_network.png">

The Satellite Network lifts the limits of ground‑based reconnaissance entirely — a Federation‑funded orbital array that watches the whole planet at once. It requires a **Nanofactory** and a **Spaceport** in the colony and a population of at least 15,000, and it is an expensive late‑game build with a steady upkeep. While it stands it grants **whole‑map intelligence**: the fog of war is lifted across the entire world, every rival colony can be inspected, and **every** species appears with full statistics in the Rankings. If you lose your last Satellite Network, already‑explored terrain stays charted, but your intelligence on rivals **reverts** to what your Biodomes and Drone Bases can see — distant enemies drop back out of your Rankings and can no longer be inspected. Build more than one for redundancy.

### How Combat Works

Combat happens when you launch a **strike force** against an enemy colony.

**1. Form the strike force.** Right‑click an enemy colony's biodome and choose
**Launch Attack**. The *Form Strike Force* dialog lists your colonies, nearest
to the target first, and under each the units that are **eligible** to attack
this target (air units in range, naval units able to reach the coast, land units
anywhere). Check the units to send and give the force a name.

**2. Assemble and travel.** The chosen units first **rally** at the participating
colony closest to the target, each travelling at its own speed. Once the whole
force has gathered, it advances to the target together, arriving after the
**slowest** unit's travel time. The Military screen shows each unit's attack
status and the turns remaining.

**3. The battle.** On arrival the strike force fights the colony's defenders —
its stationed units plus its defensive buildings. Every combatant carries three
values: **Attack** (damage dealt), **Defense** (damage mitigated per hit), and
**HP** (its health pool). For units these scale with manpower, so a half‑manned
unit has half the attack, defense, and HP of a full one; a defensive building
uses its own HP and Defense and deals no damage. The battle is fought in
**rounds**:

- Each round, the strongest attackers are paired against the toughest defenders.
  Both sides strike **simultaneously**.
- Each hit deals **damage = max(0, attacker's Attack × a random factor − the
  defender's Defense)**. The random factor is ±30% by default, so no battle is
  perfectly predictable, and heavy armor can shrug off light attacks entirely.
  That damage is subtracted from the defender's **HP**.
- Defending **units** strike back the same way. Defensive **buildings** only
  absorb — they never damage the attackers.
- A combatant whose **HP reaches zero** is removed: a destroyed unit is lost
  from the game, and a destroyed defensive building is torn down and removed from
  the colony. Surviving units keep the share of manpower equal to their
  remaining HP fraction.

Rounds continue until one side has no combatants left (or a safety cap is
reached, in which case the attacker withdraws).

**4. The outcome.** If the attacker destroys every defender and defensive
building, the colony falls and you choose what to do with it:

- **Capture** — the colony (and its surviving buildings) becomes yours, but
  **10–30%** of its non‑biodome buildings are destroyed in the fighting.
  Capturing requires at least one surviving **land** unit (Infantry or Armored)
  to occupy it.
- **Raze** — every building, **including the biodome**, is destroyed. Razing a
  colony is seen as a brutal act: it **lowers every other species' opinion of
  you** (see [Diplomacy](#diplomacy)).
- **Leave** — if you have no land units left to occupy a defeated colony (or
  simply choose not to take it), the colony is left **neutral** (ownerless) until
  another land‑bearing strike force claims it.

If the defenders win, the surviving attackers withdraw to their home base.

### Diplomacy

Every player (you and each alien species) holds an **opinion** of every other,
from **−100** (hostile) to **+100** (friendly), starting at **0**. Aggressive
acts such as **razing** a colony lower others' opinion of you. You can review how
each species currently regards you in the **Diplomacy** screen (View ▸
Diplomacy).
