<style>
img {
  width: 25%;
  float: right;
  margin: 0 0 0 1em;
}
body {
    font-size: 16pt;
}
</style>
## Terrain

The continent of Zubrenn is a patchwork of eleven terrain types. Each type sets
a cell's base Food/Material yield (per 1,000 workers), how costly it is to cross
by foot, road, sea/river, monorail, or air, and whether colonists can live and
build there. The eleven types below correspond to terrain codes `1`–`11` in
`config.json`.

#### Sea

<span class="float-right">![sea](../terrain/sea.png)</span>

The Sea blankets the lowlands between the continents, a cold cobalt expanse stirred by the pull of Zubrenn's twin stars. It yields a single unit of Food from the shoals and plankton drifting near the surface but no Material, and it cannot be settled directly. Shallow stretches become highways once a colony raises a Dock, and road or monorail bridges can leap a single sea tile to stitch neighboring lands together.

#### Grassland

<span class="float-right">![grassland](../terrain/grassland.png)</span>

Rolling Grassland is the gentle heart of the continent, carpeted in soft blue-green turf that ripples under the wind. It is the most generous starting ground, offering 2 Food and 1 Material and an easy crossing for travelers and transport alike. Flat, fertile, and welcoming, grassland is where most colonies first take root and spread their earliest farms.

#### Hills

<span class="float-right">![hills](../terrain/hills.png)</span>

The Hills rise in long, grass-stubbled ridges where the land begins to buckle toward the mountains. They trade a little fertility for mineral wealth, yielding 1 Food and 2 Material as ores press close to the surface. The uneven ground slows foot travel and makes roadbuilding a touch more laborious, but the ridges reward colonies willing to dig for what lies beneath.

#### Forest

<span class="float-right">![forest](../terrain/forest.png)</span>

Dense Forest cloaks the temperate belts in towering, slow-growing canopy. The shaded understory offers modest 1 Food but a steady 2 Material in timber and fiber, making forests a dependable source of building stock. The thick growth hampers movement and makes clearing a path time-consuming, so transport lines through the woods are built slowly and deliberately.

#### Jungle

<span class="float-right">![jungle](../terrain/jungle.png)</span>

The Jungle chokes the equatorial lowlands in riotous, humid overgrowth where strange alien flora climbs over itself in competition for light. It gives 1 Food and 2 Material but is the hardest land to traverse, swallowing roads and swallowing time as crews hack through the tangle. Beneath the dripping canopy, however, lie some of the planet's most prized biological curiosities.

#### Desert

<span class="float-right">![desert](../terrain/desert.png)</span>

The Desert stretches in sun-cracked flats and dune seas where the twin stars scorch the ground and little water remains. On its own it is barren, yielding neither Food nor Material, yet its open, firm terrain is quick to cross and cheap to road. What the desert withholds in sustenance it can repay in exotic deposits that only form in bone-dry conditions.

#### Mountain (Low)

<span class="float-right">![mountain-low](../terrain/mountain-low.png)</span>

The lower Mountains climb in pine-shadowed slopes and stony benches where the air thins and the stone turns rich. They produce no Food but a strong 3 Material as veins of ore break through the crust. Steep and demanding, they slow every traveler and make transport costly to build, and no sea or river route may pass through them — but their mineral bounty makes the effort worthwhile.

#### Mountain (High)

<span class="float-right">![mountain-high](../terrain/mountain-high.png)</span>

The high peaks of Mountains tower above the snow line in jagged, wind-scoured ridges. They are the richest source of raw Material on the planet at 4 per worked unit, but they grow no Food and cannot be settled or built upon. Treacherous and slow to cross, these summits are prized only for what can be hauled down from them to the colonies below.

#### Frozen

<span class="float-right">![frozen](../terrain/frozen.png)</span>

The Frozen wastes seal the poles and high altitudes beneath blinding sheets of ice. They offer neither Food nor Material and, above the altitude limit, are wholly impassable. Yet surprising life clings to the margins of the thaw, and colonies that endure the cold may find the ice itself harbors unexpected harvests when the brief seasons turn.

#### Plains

<span class="float-right">![plains](../terrain/plains.png)</span>

The Plains are the pale, upland cousins of the grasslands, forming where higher, drier ground gives way to open sage-colored steppe. Balanced and easily crossed, they provide 1 Food and 1 Material and lay out broad, level ground ideal for expansion. Their wide horizons make them natural corridors for roads, monorails, and the herds that roam them.

#### Wetlands

<span class="float-right">![wetlands](../terrain/wetlands.png)</span>

The Wetlands form where sea and river meet the land, a glistening maze of marsh, reed, and standing water. They produce no base Food but 1 Material, and uniquely they lift colonist spirits with a small built-in happiness bonus thanks to their serene, teeming beauty. Soggy and slow to road, the marshes nonetheless brim with life and reward colonies that learn to work the water's edge.

#### River

<span class="float-right">![wetlands](../terrain/river.png)</span>

Rivers carve a natural transportation network across the continent, offering fast routes for both goods and colonists. They also supply abundant water, essential for sustaining population growth and agricultural productivity. While unbridged rivers pose a modest barrier to foot and vehicle traffic, constructing bridges easily removes this obstacle, integrating river tiles into the broader transport grid.

#### Canals

<span class="float-right">![wetlands](../terrain/canal.png)</span>

Canals allow colonies to extend the advantages of rivers into inland regions. By excavating waterways that link landlocked tiles to existing river networks, they provide reliable navigation routes for transport vessels and a steady source of irrigation water for agriculture. Though construction demands labor and engineering, canals dramatically boost connectivity and resource availability across the continent.