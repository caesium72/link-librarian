

## Plan: 3D Graph Theme Selector with Atom/Molecule Mode

### Overview
Add a theme selector for the 3D graph allowing users to switch between the current "Cosmos" theme (Saturn/black hole) and a new "Atomic" theme inspired by atoms and molecules with comet trails and interactive moons.

---

### Changes

#### 1. Knowledge.tsx — Add Theme Selector UI
- Add new state: `graph3DTheme: "cosmos" | "atomic"` 
- Add toggle buttons next to the existing 3D/2D mode buttons
- Pass `theme` prop to `KnowledgeGraph3D`

```text
Header controls:
[3D] [2D] | [🪐 Cosmos] [⚛️ Atomic] | [Fullscreen]
```

#### 2. KnowledgeGraph3D.tsx — Implement Dual Theme System

**New Props:**
- `theme?: "cosmos" | "atomic"` — defaults to "cosmos"

**Atomic Theme Features:**

1. **Nucleus-centric layout** (replaces black hole)
   - Central glowing nucleus with orbiting protons/neutrons
   - More tightly packed electron shells

2. **Comet Trail Effect on Moons**
   - Create `CometTrail` component using a `THREE.TubeGeometry` or line segments
   - Store position history and render fading trail segments
   - Trail length ~12-15 positions, opacity fading from head to tail

3. **Clickable Moons → Sub-tag/Link Previews**
   - Add `onClick` handler to moon meshes
   - Store `moonData` with associated links from parent tag
   - On click: set `selectedMoon` state, show popover with link previews
   - Display 2-3 links in a floating tooltip panel

4. **Atom-specific visual style:**
   - Brighter neon color palette (electrons/valence shells)
   - Electron-style orbital path rings (dashed or glowing)
   - Smaller, faster-orbiting spheres with blur trails
   - Remove Saturn rings, keep orbital moons

**Scene Variants:**
- `<GraphScene theme="cosmos">` → BlackHole, OrbitalRings, SaturnRings
- `<GraphScene theme="atomic">` → AtomNucleus, ElectronShells, CometMoons

#### 3. New Components in KnowledgeGraph3D.tsx

```text
┌─────────────────────────────────────────────┐
│  AtomNucleus                                │
│  - Glowing sphere core (proton cluster)     │
│  - Orbiting smaller proton/neutron spheres  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ElectronShells                             │
│  - Neon-lit circular paths                  │
│  - Different radii for each energy level    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  CometMoons                                 │
│  - Orbiting spheres with trail geometry     │
│  - useFrame updates trail positions         │
│  - Gradient opacity from head → tail        │
│  - onClick → shows linked content           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  MoonPopover                                │
│  - Floating panel near clicked moon         │
│  - Shows 2-3 related links                  │
│  - "View all" button to select parent tag   │
└─────────────────────────────────────────────┘
```

#### 4. Updated Color Palette (Atomic Theme)

```typescript
const ATOM_COLORS = [
  { core: "#00ff88", glow: "#80ffcc", trail: "#00cc66" }, // Neon Green
  { core: "#ff00ff", glow: "#ff80ff", trail: "#cc00cc" }, // Magenta
  { core: "#00ccff", glow: "#80e0ff", trail: "#0099cc" }, // Cyan
  { core: "#ffff00", glow: "#ffff80", trail: "#cccc00" }, // Yellow
  { core: "#ff6600", glow: "#ffaa66", trail: "#cc5500" }, // Orange
  { core: "#cc66ff", glow: "#e0a0ff", trail: "#9933cc" }, // Purple
];
```

---

### Technical Details

**Comet Trail Implementation:**
- Use `useRef` to store circular buffer of last N positions
- Update buffer each frame in `useFrame`
- Render as `THREE.Line` with gradient material or multiple fading spheres

**Moon Click Interactivity:**
- Assign `userData.parentTag` and `userData.moonIndex` to moon meshes
- `onPointerDown` captures click, sets `selectedMoon` state
- `MoonPopover` renders via React portal/HTML overlay

**Theme Transition:**
- Smooth crossfade between themes using opacity transitions
- Brief scale animation when switching

---

### Files to Modify
1. `src/pages/Knowledge.tsx` — Add theme state and selector UI
2. `src/components/KnowledgeGraph3D.tsx` — Implement atomic theme components, comet trails, clickable moons

