<style>
.float-left {
  float: left;
  margin: 0 1em 0 0;
}
.float-right {
  float: right;
  margin: 0 0 0 1em;
}
.center {
  display: flex;
  justify-content: center;
  align-items: center;

}
th, td {white-space: normal; word-break: keep-all;}
</style>

<span class="center">![federation_flag](../federation_flag_256.png)</span>


## The Federation


Every colony you found belongs to a single **Federation** — the political and
economic union of all your settlements. The Federation is what turns a scattering
of lone outposts into a civilization: it pools resources, funds shared
infrastructure, and lets your colonies prop one another up through lean years.
Each alien species runs its own independent Federation on exactly the same rules.

### The capital

<span class="float-right">![federation](../128/federation.png)</span>

The **capital** is your **earliest-founded surviving colony**. It anchors the
Federation: only colonies that are **network-connected to the capital** — by road
or monorail, a river/canal chain, a sea route (Docks at both ends), an air route
(Air Fields in range), or a Spaceport link — may draw from or contribute to the
shared pool. A colony cut off from the capital still runs its own economy and can
still borrow from colonies it *is* connected to, but it cannot touch the
Federation treasury or storage until a link to the capital is restored. If the
capital is ever lost, the next-oldest surviving colony becomes the new capital.

### The treasury and pooled stores

The Federation keeps its own **pooled stores** of the seven resources — Energy,
Food, Material, Water, Wealth, Happiness, and Population — separate from any one
colony's holdings. Its **treasury** is the Federation's pooled **Wealth**. The
pool's maximum capacity for each resource is the sum of the `federationStorage`
values of your worked buildings, so building more (and working their cells) raises
how much the Federation can bank.

Resources reach the pool by **overflow**: when a colony fills its own storage for
a resource, the surplus spills into the Federation pool (up to the pool's cap;
anything beyond that is lost). Overflow only happens for colonies connected to the
capital. In the other direction, when a colony runs a **shortfall** it first
borrows from the Federation pool (if connected to the capital), then from its
connected sister colonies — so a rich colony's surplus quietly covers a struggling
neighbor's deficit.

### Taxes and happiness

The Federation funds itself by **taxing its colonies**. The **tax rate** (set with
the slider in the Federation dialog, in credits per 1,000 citizens per year) is
collected into the treasury each turn. Taxation is not free, though: it **lowers
morale**, applying a happiness penalty equal to the tax rate to every colony.
Raising taxes fills the treasury faster but drags down happiness — and happiness
drives population growth — so the rate is a balance between a wealthy Federation
and a contented, growing populace. The Federation's overall happiness is the
**population-weighted average** of its colonies' happiness.

### What the Federation pays for

Each turn the treasury (and the other pooled resources) must cover the
Federation's shared upkeep:

**Federation buildings** — certain structures (see below) are built and
  maintained entirely by the Federation rather than by any single colony.

**Transport maintenance** — the per-segment yearly cost of every **road**,
  **monorail**, **canal**, and **bridge** in your network. When the treasury can't
  keep up, unfunded segments begin to **decay** (roads fastest, monorails
  slowest).

**Network utilities and communication** — Beyond moving goods and people, the Federation's transport links also serve as
the backbone for shared utilities. Roads and monorails have
infrastructure conduits that distribute electricity and water across the
network, allowing colonies to draw from each other's surplus. The same
corridors embed fiber‑optic communication lines, enabling real‑time banking,
data exchange, and advanced colony services that would be impossible for an
isolated outpost.

The Federation dialog forecasts the annual taxes collected, each
maintenance category (including **Drone Base support**), the total maintenance,
and the resulting net change to the treasury at end of turn.

### Federation buildings

Some buildings carry the **`federation`** trait — most notably the **Drone Base**.
These belong to the Federation, not to any one colony:

Their **construction cost and yearly upkeep are paid from the Federation pool**, not a colony's storage.

They may be placed **outside your zone of control**, and are delivered to the site by **route planning** (like founding a colony): build time plus travel time, sped up by roads and monorails and blocked by impassable terrain and rival territory.

They stay active **only as long as the Federation can afford their upkeep**. If
  the pool falls short in any resource, federation buildings are **idled at
  random** until the remaining fleet fits the budget. An idled building stops
  functioning — an idled Drone Base, for instance, stops gathering intelligence —
  and resumes once the Federation can pay again.

Because a federation building requires a Federation to fund it, you must have
**founded a second colony** (establishing the Federation) before any can be built.

### Establishing your Federation

Your Federation comes into being the moment you found your **second colony** — a
lone settlement has nothing to federate. From that point you have a capital, a
treasury, pooled storage, a tax rate to tune, and the ability to raise
Federation-funded infrastructure. Grow your network, keep your colonies linked to
the capital, and balance taxation against morale, and the Federation becomes the
backbone that carries your civilization across the whole of Zubrenn.
