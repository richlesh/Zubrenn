//! Zubrenn movement-cost flood-fill kernel (Dijkstra), compiled to
//! wasm32-unknown-unknown with a hand-written C-ABI (no wasm-bindgen).
//!
//! Faithful port of index.html `findMovementCostsFrom`. All arithmetic is f64
//! to match the JS engine exactly, so the per-cell cheapest-cost output is
//! bit-identical to the JS implementation (verified by an equivalence harness).
//!
//! Memory model: JS allocates buffers via `alloc`, fills them, and passes their
//! pointers to `flood`. The kernel writes the per-cell best cost into the
//! `out_dist` buffer (f64, length W*H; unreached cells = f64::INFINITY).
//!
//! Direction order (must match hexNeighborsRenderer in index.html), bit i in a
//! per-cell 6-bit mask corresponds to neighbor i:
//!   even column (x&1==0): [ (0,-1),(0,+1),(+1,-1),(+1,0),(-1,-1),(-1,0) ]
//!   odd  column (x&1==1): [ (0,-1),(0,+1),(+1,0),(+1,+1),(-1,0),(-1,+1) ]

#![no_std]

use core::alloc::{GlobalAlloc, Layout};
use core::cell::UnsafeCell;

// ---- Minimal bump allocator (single-threaded wasm) -------------------------
const ARENA_SIZE: usize = 64 * 1024 * 1024; // 64 MiB arena
#[repr(align(16))]
struct Arena(UnsafeCell<[u8; ARENA_SIZE]>);
unsafe impl Sync for Arena {}
static ARENA: Arena = Arena(UnsafeCell::new([0; ARENA_SIZE]));
static mut ARENA_OFF: usize = 0;

struct Bump;
unsafe impl GlobalAlloc for Bump {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let align = layout.align();
        let off = (ARENA_OFF + (align - 1)) & !(align - 1);
        let end = off + layout.size();
        if end > ARENA_SIZE {
            return core::ptr::null_mut();
        }
        ARENA_OFF = end;
        (ARENA.0.get() as *mut u8).add(off)
    }
    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {}
}
#[global_allocator]
static GLOBAL: Bump = Bump;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// ---- Exported buffer allocation --------------------------------------------
// JS calls alloc() to get offsets into the shared memory it reads/writes.
#[no_mangle]
pub extern "C" fn alloc(nbytes: usize) -> *mut u8 {
    unsafe {
        let align = 16;
        let off = (ARENA_OFF + (align - 1)) & !(align - 1);
        let end = off + nbytes;
        if end > ARENA_SIZE {
            return core::ptr::null_mut();
        }
        ARENA_OFF = end;
        (ARENA.0.get() as *mut u8).add(off)
    }
}

// Reset the arena bump pointer (JS calls this to reuse memory between uploads).
#[no_mangle]
pub extern "C" fn reset_arena(to: usize) {
    unsafe {
        ARENA_OFF = to;
    }
}

#[no_mangle]
pub extern "C" fn arena_offset() -> usize {
    unsafe { ARENA_OFF }
}

// ---- Direction tables ------------------------------------------------------
// (dx,dy) per neighbor index for even/odd columns, matching hexNeighborsRenderer.
const DIR_EVEN: [(i32, i32); 6] = [(0, -1), (0, 1), (1, -1), (1, 0), (-1, -1), (-1, 0)];
const DIR_ODD: [(i32, i32); 6] = [(0, -1), (0, 1), (1, 0), (1, 1), (-1, 0), (-1, 1)];

#[inline]
fn neighbor(x: i32, y: i32, i: usize) -> (i32, i32) {
    let d = if (x & 1) == 1 { DIR_ODD[i] } else { DIR_EVEN[i] };
    (x + d.0, y + d.1)
}

// ---- Binary min-heap over (cost f64, state u32) ----------------------------
struct Heap {
    cost: &'static mut [f64],
    state: &'static mut [u32],
    len: usize,
}
impl Heap {
    #[inline]
    fn push(&mut self, c: f64, s: u32) {
        let mut i = self.len;
        self.cost[i] = c;
        self.state[i] = s;
        self.len += 1;
        while i > 0 {
            let p = (i - 1) >> 1;
            if self.cost[p] <= self.cost[i] {
                break;
            }
            self.cost.swap(p, i);
            self.state.swap(p, i);
            i = p;
        }
    }
    #[inline]
    fn pop(&mut self) -> (f64, u32) {
        let top = (self.cost[0], self.state[0]);
        self.len -= 1;
        let n = self.len;
        if n > 0 {
            self.cost[0] = self.cost[n];
            self.state[0] = self.state[n];
            let mut i = 0usize;
            loop {
                let l = 2 * i + 1;
                let r = 2 * i + 2;
                let mut s = i;
                if l < n && self.cost[l] < self.cost[s] {
                    s = l;
                }
                if r < n && self.cost[r] < self.cost[s] {
                    s = r;
                }
                if s == i {
                    break;
                }
                self.cost.swap(i, s);
                self.state.swap(i, s);
                i = s;
            }
        }
        top
    }
}

#[inline]
fn mv_at(movement: &[f64], terr: u8, i: usize, dflt: f64) -> f64 {
    // movement table is row-major [terrainId * 5 + mode]; terrain ids 1..=11.
    let base = (terr as usize) * 5;
    let v = movement[base + i];
    if v.is_nan() {
        dflt
    } else {
        v
    }
}

// Globals set by set_params, pointers into the arena.
struct Ctx {
    w: i32,
    h: i32,
    wrap: bool,
    terrain: *const u8,
    impassable: *const u8,
    shallow: *const u8,
    foreign: *const u8,
    dock: *const u8,
    port: *const u8,
    mono_mask: *const u8,
    road_mask: *const u8,  // road OR bridge edges
    bridge_mask: *const u8,
    river_mask: *const u8, // river/canal border edges
    movement: *const f64,  // len (maxTerrId+1)*5
    cross_cost: f64,
}
static mut CTX: Option<Ctx> = None;

#[no_mangle]
pub extern "C" fn set_params(
    w: i32,
    h: i32,
    wrap: i32,
    terrain: *const u8,
    impassable: *const u8,
    shallow: *const u8,
    foreign: *const u8,
    dock: *const u8,
    port: *const u8,
    mono_mask: *const u8,
    road_mask: *const u8,
    bridge_mask: *const u8,
    river_mask: *const u8,
    movement: *const f64,
    cross_cost: f64,
) {
    unsafe {
        CTX = Some(Ctx {
            w, h, wrap: wrap != 0, terrain, impassable, shallow, foreign, dock, port,
            mono_mask, road_mask, bridge_mask, river_mask, movement, cross_cost,
        });
    }
}

#[inline]
fn wx(ctx: &Ctx, x: i32) -> i32 {
    if ctx.wrap {
        ((x % ctx.w) + ctx.w) % ctx.w
    } else {
        x
    }
}

/// Run the flood from (sx,sy). Writes per-cell best cost into out_dist (f64,
/// len W*H), INFINITY = unreached. heap buffers must hold >= cap entries.
/// Returns the number of cells reached (debug/sanity).
///
/// phase packing: state = cellIndex*4 + phase. phases 0=LAND_PRE 1=SEA_DOCK
/// 2=SEA_PORT 3=LAND_POST.
#[no_mangle]
pub extern "C" fn flood(
    sx: i32,
    sy: i32,
    max_cost: f64, // use INFINITY for "no cap"
    out_dist: *mut f64,
    heap_cost: *mut f64,
    heap_state: *mut u32,
    dist_state: *mut f64, // per-state best (len W*H*4), INFINITY init
    done_state: *mut u8,  // per-state done flag (len W*H*4)
) -> i32 {
    let ctx = unsafe {
        match CTX.as_ref() {
            Some(c) => c,
            None => return -1,
        }
    };
    let w = ctx.w;
    let h = ctx.h;
    let n = (w * h) as usize;
    let nstate = n * 4;

    let terrain = unsafe { core::slice::from_raw_parts(ctx.terrain, n) };
    let impassable = unsafe { core::slice::from_raw_parts(ctx.impassable, n) };
    let shallow = unsafe { core::slice::from_raw_parts(ctx.shallow, n) };
    let foreign = unsafe { core::slice::from_raw_parts(ctx.foreign, n) };
    let dock = unsafe { core::slice::from_raw_parts(ctx.dock, n) };
    let port = unsafe { core::slice::from_raw_parts(ctx.port, n) };
    let mono = unsafe { core::slice::from_raw_parts(ctx.mono_mask, n) };
    let road = unsafe { core::slice::from_raw_parts(ctx.road_mask, n) };
    let bridge = unsafe { core::slice::from_raw_parts(ctx.bridge_mask, n) };
    let river = unsafe { core::slice::from_raw_parts(ctx.river_mask, n) };
    // movement rows for ids 0..=11
    let movement = unsafe { core::slice::from_raw_parts(ctx.movement, 12 * 5) };

    let out = unsafe { core::slice::from_raw_parts_mut(out_dist, n) };
    let dstate = unsafe { core::slice::from_raw_parts_mut(dist_state, nstate) };
    let done = unsafe { core::slice::from_raw_parts_mut(done_state, nstate) };
    let hcost = unsafe { core::slice::from_raw_parts_mut(heap_cost, nstate + 1) };
    let hstate = unsafe { core::slice::from_raw_parts_mut(heap_state, nstate + 1) };

    for v in out.iter_mut() {
        *v = f64::INFINITY;
    }
    for v in dstate.iter_mut() {
        *v = f64::INFINITY;
    }
    for v in done.iter_mut() {
        *v = 0;
    }

    let sxx = wx(ctx, sx);
    if sxx < 0 || sxx >= w || sy < 0 || sy >= h {
        return 0;
    }
    let scell = (sy * w + sxx) as usize;
    let start_phase: u32 = if terrain[scell] == 1 { 2 } else { 0 }; // sea->SEA_PORT else LAND_PRE
    let sstate = (scell as u32) * 4 + start_phase;

    let mut heap = Heap { cost: hcost, state: hstate, len: 0 };
    dstate[sstate as usize] = 0.0;
    out[scell] = 0.0;
    heap.push(0.0, sstate);

    let mut reached = 0i32;
    let cap: u64 = (w as u64) * (h as u64) * 6 + 100;
    let mut guard: u64 = 0;

    while heap.len > 0 && guard < cap {
        guard += 1;
        let (cd, cs) = heap.pop();
        if done[cs as usize] != 0 {
            continue;
        }
        done[cs as usize] = 1;
        reached += 1;
        if cd > max_cost {
            continue;
        }
        let cell = (cs / 4) as i32;
        let ph = (cs % 4) as u32;
        let cx = cell % w;
        let cy = cell / w;

        for i in 0..6 {
            let (rnx, rny) = neighbor(cx, cy, i);
            let nx = wx(ctx, rnx);
            let ny = rny;
            if ny < 0 || ny >= h || nx < 0 || nx >= w {
                continue;
            }
            let ncell = (ny * w + nx) as usize;
            let terr = terrain[ncell];
            let is_sea = terr == 1;

            // Land passability: terrain 2..=11 and not impassable; off-map excluded.
            if !is_sea {
                if terr < 2 || terr > 11 || impassable[ncell] != 0 {
                    continue;
                }
            }

            // Phase machine (routePhaseNext).
            let nph: i32 = if !is_sea {
                match ph {
                    1 | 2 => 3,          // SEA_DOCK/SEA_PORT -> LAND_POST
                    other => other as i32, // LAND_PRE/LAND_POST keep
                }
            } else {
                match ph {
                    0 => {
                        // LAND_PRE entering sea
                        if port[ncell] != 0 {
                            2
                        } else if dock[ncell] != 0 && shallow[ncell] != 0 {
                            1
                        } else {
                            -1
                        }
                    }
                    1 => {
                        if shallow[ncell] != 0 {
                            1
                        } else {
                            -1
                        }
                    }
                    2 => 2,
                    _ => -1, // LAND_POST may not re-enter sea
                }
            };
            if nph < 0 {
                continue;
            }

            // Foreign-controlled cells are skipped (by cell, any phase).
            if foreign[ncell] != 0 {
                continue;
            }

            let nstate_idx = (ncell as u32) * 4 + nph as u32;
            if done[nstate_idx as usize] != 0 {
                continue;
            }

            // enterCost(nx,ny, from=cx,cy). AI always passes a from-cell.
            let mut cost = if is_sea {
                mv_at(movement, terr, 2, mv_at(movement, terr, 0, 1.0))
            } else {
                mv_at(movement, terr, 0, 1.0)
            };
            // Edge discounts via the from-cell's direction mask (bit i).
            let bit = 1u8 << i;
            let has_mono = (mono[(cy * w + cx) as usize] & bit) != 0;
            let has_road = (road[(cy * w + cx) as usize] & bit) != 0;
            let has_bridge = (bridge[(cy * w + cx) as usize] & bit) != 0;
            if has_mono {
                cost = mv_at(movement, terr, 3, cost);
            } else if has_road || has_bridge {
                cost = mv_at(movement, terr, 1, cost);
            }
            // River crossing: +cross_cost when the border is river/canal and no bridge.
            let has_river = (river[(cy * w + cx) as usize] & bit) != 0;
            if has_river && !has_bridge {
                cost += ctx.cross_cost;
            }

            let nd = cd + cost;
            if max_cost.is_finite() && nd > max_cost {
                continue;
            }
            if nd < dstate[nstate_idx as usize] {
                dstate[nstate_idx as usize] = nd;
                if nd < out[ncell] {
                    out[ncell] = nd;
                }
                heap.push(nd, nstate_idx);
            }
        }
    }

    reached
}
