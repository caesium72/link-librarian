import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Float } from "@react-three/drei";
import * as THREE from "three";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Filter, RotateCcw, Circle } from "lucide-react";
import type { Link } from "@/types/links";

// ─── Planet color palette ───
const PLANET_COLORS = [
  { core: "#e8a838", glow: "#f5d070", ring: "#d4a030", name: "Saturn Gold" },
  { core: "#6b8cff", glow: "#a0b4ff", ring: "#4a6bef", name: "Neptune Blue" },
  { core: "#ff6b6b", glow: "#ff9e9e", ring: "#e04545", name: "Mars Red" },
  { core: "#50d890", glow: "#80f0b0", ring: "#30b870", name: "Earth Green" },
  { core: "#c478ff", glow: "#daa0ff", ring: "#a050e0", name: "Pluto Purple" },
  { core: "#ff8c42", glow: "#ffb880", ring: "#e07020", name: "Jupiter Orange" },
  { core: "#42d4f4", glow: "#80e8ff", ring: "#20b0d4", name: "Uranus Cyan" },
  { core: "#ff6eb4", glow: "#ffa0d0", ring: "#e04898", name: "Venus Pink" },
];

function getPlanetColor(index: number) {
  return PLANET_COLORS[index % PLANET_COLORS.length];
}

interface Node3D {
  id: string;
  label: string;
  count: number;
  position: [number, number, number];
  radius: number;
  colorIndex: number;
}

interface Edge3D {
  source: string;
  target: string;
  weight: number;
}

function buildGraph3D(links: Link[]) {
  const tagCount: Record<string, number> = {};
  const cooccurrence: Record<string, number> = {};
  const tagLinks: Record<string, Link[]> = {};

  for (const link of links) {
    const tags = link.tags || [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
      if (!tagLinks[tag]) tagLinks[tag] = [];
      tagLinks[tag].push(link);
    }
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join("|||");
        cooccurrence[key] = (cooccurrence[key] || 0) + 1;
      }
    }
  }

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([tag]) => tag);

  const topSet = new Set(topTags);
  const maxC = Math.max(...topTags.map((t) => tagCount[t]), 1);

  // Orbital shell layout — like electron shells around a nucleus
  // Most important tags go in inner orbits, less important in outer orbits
  const shellConfig = [
    { maxNodes: 3, radius: 4, tiltY: 0 },      // Inner shell — top 3 tags
    { maxNodes: 6, radius: 7, tiltY: 0.4 },     // Second shell
    { maxNodes: 10, radius: 11, tiltY: -0.3 },   // Third shell
    { maxNodes: 21, radius: 16, tiltY: 0.6 },    // Outer shell
  ];

  const nodes: Node3D[] = [];
  let tagIndex = 0;

  for (const shell of shellConfig) {
    const nodesInShell = topTags.slice(tagIndex, tagIndex + shell.maxNodes);
    const count = nodesInShell.length;
    if (count === 0) break;

    for (let i = 0; i < count; i++) {
      const tag = nodesInShell[i];
      const angle = (2 * Math.PI * i) / count;
      // Distribute on tilted orbital plane with slight vertical scatter
      const verticalScatter = (Math.random() - 0.5) * 1.5;
      const r = 0.25 + (tagCount[tag] / maxC) * 0.55;

      nodes.push({
        id: tag,
        label: tag,
        count: tagCount[tag],
        position: [
          shell.radius * Math.cos(angle),
          shell.radius * Math.sin(angle) * Math.sin(shell.tiltY) + verticalScatter,
          shell.radius * Math.sin(angle) * Math.cos(shell.tiltY),
        ] as [number, number, number],
        radius: r,
        colorIndex: tagIndex + i,
      });
    }
    tagIndex += count;
  }

  const edges: Edge3D[] = [];
  for (const [key, weight] of Object.entries(cooccurrence)) {
    const [a, b] = key.split("|||");
    if (topSet.has(a) && topSet.has(b)) {
      edges.push({ source: a, target: b, weight });
    }
  }

  return { nodes, edges, tagLinks };
}

// ─── Saturn-style ring with tilt and texture ───
function SaturnRing({
  radius,
  thickness,
  color,
  opacity,
  tiltX,
  tiltZ,
  speed,
}: {
  radius: number;
  thickness: number;
  color: string;
  opacity: number;
  tiltX: number;
  tiltZ: number;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = tiltX + Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.05;
    ref.current.rotation.z = tiltZ;
    ref.current.rotation.y += speed * 0.003;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, thickness, 4, 128]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Atmospheric glow shell ───
function AtmosphereShell({ radius, color, opacity }: { radius: number; color: string; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.02;
    ref.current.scale.setScalar(1 + pulse);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity + Math.sin(state.clock.elapsedTime * 1.5) * 0.02;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ─── 3D Planet Node ───
function PlanetNode({
  node,
  isSelected,
  isConnected,
  isHovered,
  isDimmed,
  maxCount,
  onSelect,
  onHover,
}: {
  node: Node3D;
  isSelected: boolean;
  isConnected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  maxCount: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const currentScale = useRef(1);
  const pulsePhase = useRef(Math.random() * Math.PI * 2);
  const planet = getPlanetColor(node.colorIndex);

  // Wobble axis for realistic rotation
  const wobbleAxis = useRef(new THREE.Vector3(
    Math.random() * 0.3 - 0.15,
    1,
    Math.random() * 0.3 - 0.15
  ).normalize());

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.5 : isHovered ? 1.3 : isConnected ? 1.12 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 5, 1);

    // Breathing pulse
    const pulse = Math.sin(state.clock.elapsedTime * 1.2 + pulsePhase.current) * 0.03;
    meshRef.current.scale.setScalar(currentScale.current + pulse);

    // Realistic axial rotation
    meshRef.current.rotateOnAxis(wobbleAxis.current, delta * 0.4);
  });

  // When dimmed (another node is selected), go dark grey
  const dimColor = "#2a2a35";
  const dimGlow = "#1a1a22";
  const activeColor = isDimmed ? dimColor : planet.core;
  const activeGlow = isDimmed ? dimGlow : planet.glow;
  const activeRing = isDimmed ? "#3a3a45" : planet.ring;

  const emissiveIntensity = isSelected ? 1.4 : isHovered ? 0.8 : isDimmed ? 0.02 : 0.2;
  const sizeNorm = node.count / maxCount;
  const sphereOpacity = isSelected ? 0.98 : isDimmed ? 0.5 : 0.75;
  const ringBaseOpacity = isDimmed ? 0.08 : 0.25;

  return (
    <group position={node.position}>
      {/* Outer atmosphere glow — hidden when dimmed, bright when selected */}
      <AtmosphereShell radius={node.radius * 2.8} color={activeGlow} opacity={isSelected ? 0.2 : isDimmed ? 0.01 : 0.05} />
      <AtmosphereShell radius={node.radius * 1.8} color={activeColor} opacity={isSelected ? 0.3 : isDimmed ? 0.02 : 0.08} />

      {/* Main planet sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : node.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[node.radius, 64, 64]} />
        <meshPhysicalMaterial
          color={activeColor}
          emissive={activeGlow}
          emissiveIntensity={emissiveIntensity}
          metalness={isDimmed ? 0.05 : 0.1}
          roughness={isDimmed ? 0.7 : 0.25}
          clearcoat={isDimmed ? 0.2 : 1.0}
          clearcoatRoughness={isDimmed ? 0.5 : 0.1}
          transparent
          opacity={sphereOpacity}
        />
      </mesh>

      {/* Saturn-style rings */}
      <SaturnRing
        radius={node.radius * 1.7}
        thickness={0.025 + sizeNorm * 0.018}
        color={activeRing}
        opacity={isSelected ? 0.85 : ringBaseOpacity}
        tiltX={1.2}
        tiltZ={0.2}
        speed={isDimmed ? 0.3 : 1.5}
      />
      <SaturnRing
        radius={node.radius * 2.0}
        thickness={0.015 + sizeNorm * 0.012}
        color={activeGlow}
        opacity={isSelected ? 0.65 : ringBaseOpacity * 0.7}
        tiltX={1.1}
        tiltZ={0.3}
        speed={isDimmed ? -0.2 : -1.0}
      />
      <SaturnRing
        radius={node.radius * 2.35}
        thickness={0.01}
        color={activeColor}
        opacity={isSelected ? 0.5 : ringBaseOpacity * 0.5}
        tiltX={1.3}
        tiltZ={-0.1}
        speed={isDimmed ? 0.1 : 0.6}
      />

      {/* Label */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, node.radius + 0.4, 0]}
          fontSize={0.22}
          color={isSelected || isHovered ? "#ffffff" : "#d4d4d8"}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {node.label}
        </Text>
        <Text
          position={[0, 0, 0]}
          fontSize={0.16}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineWidth={0.012}
          outlineColor="#000000"
        >
          {String(node.count)}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Animated edge with energy pulse ───
function EdgeLine({
  from,
  to,
  weight,
  maxWeight,
  isHighlighted,
  isDimmed,
  sourceColor,
  targetColor,
}: {
  from: [number, number, number];
  to: [number, number, number];
  weight: number;
  maxWeight: number;
  isHighlighted: boolean;
  isDimmed: boolean;
  sourceColor: string;
  targetColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const pulseRef = useRef<THREE.Mesh>(null!);

  const { curve, lineObj } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const offset = mid.clone().normalize().multiplyScalar(0.6);
    mid.add(offset);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(48);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = isHighlighted ? sourceColor : "#3a3a4a";
    const opacity = isDimmed ? 0.02 : isHighlighted ? 0.6 : 0.12;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const lineObj = new THREE.Line(geometry, material);
    return { curve, lineObj };
  }, [from, to, isHighlighted, isDimmed, sourceColor]);

  // Pulse traveling along the edge
  useFrame((state) => {
    if (!pulseRef.current || !isHighlighted) return;
    const t = (state.clock.elapsedTime * 0.3) % 1;
    const pos = curve.getPoint(t);
    pulseRef.current.position.copy(pos);
  });

  return (
    <group ref={groupRef}>
      <primitive object={lineObj} />
      {isHighlighted && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={sourceColor} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// ─── Floating particles background ───
function Particles() {
  const count = 600;
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.008;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.004) * 0.06;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#8b8baf" transparent opacity={0.45} sizeAttenuation />
    </points>
  );
}

// ─── Central black hole with accretion disk ───
function BlackHole() {
  const diskRef = useRef<THREE.Mesh>(null!);
  const disk2Ref = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (diskRef.current) diskRef.current.rotation.z = t * 0.15;
    if (disk2Ref.current) disk2Ref.current.rotation.z = -t * 0.1;
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2) * 0.05;
      coreRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 1.5) * 0.04;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#6040ff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh ref={diskRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[2.0, 0.15, 4, 128]} />
        <meshStandardMaterial color="#ff8040" emissive="#ff6020" emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={disk2Ref} rotation={[Math.PI / 2.5, 0.3, 0]}>
        <torusGeometry args={[2.8, 0.08, 4, 128]} />
        <meshStandardMaterial color="#a060ff" emissive="#8040e0" emissiveIntensity={0.5} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Orbital ring guides (electron shell style) ───
function OrbitalRings() {
  const refs = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speeds = [0.02, -0.015, 0.01, -0.008];
    refs.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.y = t * speeds[i];
    });
  });

  const ringData = [
    { radius: 4, tiltX: Math.PI / 2, opacity: 0.08 },
    { radius: 7, tiltX: Math.PI / 2 + 0.4, opacity: 0.06 },
    { radius: 11, tiltX: Math.PI / 2 - 0.3, opacity: 0.04 },
    { radius: 16, tiltX: Math.PI / 2 + 0.6, opacity: 0.03 },
  ];

  return (
    <>
      {ringData.map((r, i) => (
        <mesh key={i} ref={refs[i]} rotation={[r.tiltX, 0, 0]}>
          <torusGeometry args={[r.radius, 0.015, 4, 256]} />
          <meshBasicMaterial color="#6b8cff" transparent opacity={r.opacity} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// ─── Scene ───
function GraphScene({
  nodes,
  edges,
  selectedTag,
  hoveredTag,
  connectedTags,
  maxWeight,
  maxCount,
  onSelect,
  onHover,
}: {
  nodes: Node3D[];
  edges: Edge3D[];
  selectedTag: string | null;
  hoveredTag: string | null;
  connectedTags: Set<string>;
  maxWeight: number;
  maxCount: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[15, 15, 15]} intensity={2.0} color="#ffd080" />
      <pointLight position={[-15, -10, -8]} intensity={1.2} color="#6080ff" />
      <pointLight position={[0, 12, -15]} intensity={0.7} color="#ff80c0" />
      <pointLight position={[8, -8, 12]} intensity={0.5} color="#80ffc0" />
      <directionalLight position={[0, 8, 8]} intensity={0.3} />

      <BlackHole />
      <OrbitalRings />
      <Particles />

      {edges.map((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        const isHighlighted =
          selectedTag === edge.source || selectedTag === edge.target ||
          hoveredTag === edge.source || hoveredTag === edge.target;
        const isDimmed = !!(selectedTag || hoveredTag) && !isHighlighted;
        return (
          <EdgeLine
            key={`${edge.source}-${edge.target}`}
            from={s.position}
            to={t.position}
            weight={edge.weight}
            maxWeight={maxWeight}
            isHighlighted={isHighlighted}
            isDimmed={isDimmed}
            sourceColor={getPlanetColor(s.colorIndex).core}
            targetColor={getPlanetColor(t.colorIndex).core}
          />
        );
      })}

      {nodes.map((node) => (
        <Float
          key={node.id}
          speed={selectedTag === node.id ? 2.5 : 1.2}
          rotationIntensity={selectedTag === node.id ? 0.15 : 0.04}
          floatIntensity={selectedTag === node.id ? 0.35 : 0.12}
          floatingRange={[-0.06, 0.06]}
        >
          <PlanetNode
            node={node}
            isSelected={selectedTag === node.id}
            isConnected={connectedTags.has(node.id)}
            isHovered={hoveredTag === node.id}
            isDimmed={!!selectedTag && selectedTag !== node.id}
            maxCount={maxCount}
            onSelect={onSelect}
            onHover={onHover}
          />
        </Float>
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={6}
        maxDistance={35}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.2}
      />
    </>
  );
}

// ─── Color Legend ───
function ColorLegend({ nodes, maxCount }: { nodes: Node3D[]; maxCount: number }) {
  return (
    <div className="absolute top-3 right-3 bg-background/85 backdrop-blur-md rounded-lg border border-border/50 p-3 space-y-2.5 max-w-[180px] animate-in fade-in slide-in-from-right-3 duration-500 pointer-events-auto">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legend</p>

      {/* Size meaning */}
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground font-medium">Node Size = Link Count</p>
        <div className="flex items-end gap-1.5 h-5">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
          <div className="w-4 h-4 rounded-full bg-muted-foreground/60" />
          <span className="text-[8px] text-muted-foreground ml-1">few → many</span>
        </div>
      </div>

      {/* Color groups */}
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground font-medium">Color = Tag Group</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {PLANET_COLORS.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.core, boxShadow: `0 0 4px ${c.glow}` }} />
              <span className="text-[8px] text-muted-foreground truncate">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rings meaning */}
      <div className="space-y-0.5">
        <p className="text-[9px] text-muted-foreground font-medium">Rings = Connections</p>
        <p className="text-[8px] text-muted-foreground/70">Brighter rings = more active</p>
      </div>

      {/* Edge meaning */}
      <div className="space-y-0.5">
        <p className="text-[9px] text-muted-foreground font-medium">Edges = Co-occurrence</p>
        <p className="text-[8px] text-muted-foreground/70">Tags appearing together on links</p>
      </div>
    </div>
  );
}

// ─── Main Export ───
interface KnowledgeGraph3DProps {
  links: Link[];
  isLoading: boolean;
}

export function KnowledgeGraph3D({ links, isLoading }: KnowledgeGraph3DProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  const { nodes, edges, tagLinks } = useMemo(() => buildGraph3D(links), [links]);
  const maxWeight = useMemo(() => Math.max(...edges.map((e) => e.weight), 1), [edges]);
  const maxCount = useMemo(() => Math.max(...nodes.map((n) => n.count), 1), [nodes]);

  const connectedTags = useMemo(() => {
    const tag = selectedTag || hoveredTag;
    if (!tag) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.source === tag) set.add(e.target);
      if (e.target === tag) set.add(e.source);
    }
    return set;
  }, [selectedTag, hoveredTag, edges]);

  const selectedTagLinks = useMemo(() => {
    if (!selectedTag || !tagLinks[selectedTag]) return [];
    return tagLinks[selectedTag].slice(0, 8);
  }, [selectedTag, tagLinks]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No tags found. Add tags to your links to see the 3D knowledge graph.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/10 hover:border-primary/20 transition-colors duration-300">
        <CardContent className="p-0 relative">
          <div className="h-[500px] w-full bg-background">
            <Canvas
              camera={{ position: [0, 0, 10], fov: 50 }}
              dpr={[1, 2]}
              style={{ background: "transparent" }}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              onPointerMissed={() => setSelectedTag(null)}
            >
              <fog attach="fog" args={["#09090b", 16, 28]} />
              <GraphScene
                nodes={nodes}
                edges={edges}
                selectedTag={selectedTag}
                hoveredTag={hoveredTag}
                connectedTags={connectedTags}
                maxWeight={maxWeight}
                maxCount={maxCount}
                onSelect={setSelectedTag}
                onHover={setHoveredTag}
              />
            </Canvas>
          </div>

          {/* Color Legend */}
          <ColorLegend nodes={nodes} maxCount={maxCount} />

          {/* Controls hint */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border/40 animate-in fade-in duration-500">
            <RotateCcw className="h-3 w-3" />
            Drag to orbit · Scroll to zoom · Click nodes
          </div>

          {/* Hovered tag tooltip */}
          {hoveredTag && !selectedTag && (
            <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/60 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: getPlanetColor(nodes.find(n => n.id === hoveredTag)?.colorIndex || 0).core }} />
                <p className="text-xs font-semibold">{hoveredTag}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {tagLinks[hoveredTag]?.length || 0} links · {connectedTags.size} connections
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selectedTag && (
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-400 hover:border-primary/20 transition-all">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary animate-pulse" />
                Tag: <Badge variant="default" className="animate-in zoom-in-95 duration-200">{selectedTag}</Badge>
                <span className="text-muted-foreground font-normal">
                  · {tagLinks[selectedTag]?.length || 0} links
                </span>
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedTag(null)}>
                Clear
              </Button>
            </div>

            {connectedTags.size > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
                <p className="text-xs text-muted-foreground mb-1.5">Connected tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(connectedTags).map((tag, i) => {
                    const tagNode = nodes.find(n => n.id === tag);
                    const color = tagNode ? getPlanetColor(tagNode.colorIndex).core : undefined;
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:scale-105 transition-all duration-200 animate-in fade-in zoom-in-90"
                        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both", borderColor: color }}
                        onClick={() => setSelectedTag(tag)}
                      >
                        {color && <div className="w-2 h-2 rounded-full mr-1 shrink-0" style={{ background: color }} />}
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedTagLinks.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
                <p className="text-xs text-muted-foreground mb-1.5">Links with this tag</p>
                <div className="space-y-1.5">
                  {selectedTagLinks.map((link, i) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted hover:-translate-y-px transition-all duration-200 group animate-in fade-in slide-in-from-left-2"
                      style={{ animationDelay: `${200 + i * 60}ms`, animationFillMode: "both" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{link.title || "Untitled"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{link.domain}</p>
                      </div>
                      <a
                        href={link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
