import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Float, Html } from "@react-three/drei";
import * as THREE from "three";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Filter, RotateCcw, Circle, X, Search, Route, Clock3, GitBranch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { Link } from "@/types/links";

// ─── Planet color palette (Cosmos theme) ───
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

// ─── Atom color palette (Atomic theme) ───
const ATOM_COLORS = [
  { core: "#00ff88", glow: "#80ffcc", trail: "#00cc66", name: "Neon Green" },
  { core: "#ff00ff", glow: "#ff80ff", trail: "#cc00cc", name: "Magenta" },
  { core: "#00ccff", glow: "#80e0ff", trail: "#0099cc", name: "Cyan" },
  { core: "#ffff00", glow: "#ffff80", trail: "#cccc00", name: "Yellow" },
  { core: "#ff6600", glow: "#ffaa66", trail: "#cc5500", name: "Orange" },
  { core: "#cc66ff", glow: "#e0a0ff", trail: "#9933cc", name: "Purple" },
  { core: "#ff3366", glow: "#ff8099", trail: "#cc1144", name: "Pink" },
  { core: "#66ff99", glow: "#99ffcc", trail: "#33cc66", name: "Mint" },
];

// ─── Sphere color palette (Sphere theme) ───
const SPHERE_COLORS = [
  { core: "#4fc3f7", glow: "#81d4fa", edge: "#29b6f6", name: "Sky Blue" },
  { core: "#ba68c8", glow: "#ce93d8", edge: "#ab47bc", name: "Lavender" },
  { core: "#81c784", glow: "#a5d6a7", edge: "#66bb6a", name: "Sage" },
  { core: "#ffb74d", glow: "#ffcc80", edge: "#ffa726", name: "Amber" },
  { core: "#f06292", glow: "#f48fb1", edge: "#ec407a", name: "Rose" },
  { core: "#4dd0e1", glow: "#80deea", edge: "#26c6da", name: "Teal" },
  { core: "#fff176", glow: "#fff59d", edge: "#ffee58", name: "Lemon" },
  { core: "#7986cb", glow: "#9fa8da", edge: "#5c6bc0", name: "Indigo" },
];

// ─── Ocean color palette (Deep Ocean theme) ───
const OCEAN_COLORS = [
  { core: "#00e5ff", glow: "#80f0ff", tentacle: "#00b8d4", name: "Jellyfish Cyan" },
  { core: "#ea80fc", glow: "#f0b0ff", tentacle: "#d500f9", name: "Anemone Purple" },
  { core: "#69f0ae", glow: "#b0ffd0", tentacle: "#00e676", name: "Algae Green" },
  { core: "#ffab40", glow: "#ffd080", tentacle: "#ff9100", name: "Coral Orange" },
  { core: "#ff80ab", glow: "#ffb0cc", tentacle: "#ff4081", name: "Sea Rose" },
  { core: "#40c4ff", glow: "#80d8ff", tentacle: "#0091ea", name: "Deep Blue" },
  { core: "#b388ff", glow: "#d0b0ff", tentacle: "#7c4dff", name: "Urchin Violet" },
  { core: "#64ffda", glow: "#a0ffe8", tentacle: "#1de9b6", name: "Plankton Teal" },
];

function getPlanetColor(index: number) {
  return PLANET_COLORS[index % PLANET_COLORS.length];
}

function getAtomColor(index: number) {
  return ATOM_COLORS[index % ATOM_COLORS.length];
}

function getSphereColor(index: number) {
  return SPHERE_COLORS[index % SPHERE_COLORS.length];
}

function getOceanColor(index: number) {
  return OCEAN_COLORS[index % OCEAN_COLORS.length];
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

function buildGraph3D(links: Link[], theme: "cosmos" | "atomic" | "sphere" | "ocean") {
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

  const nodes: Node3D[] = [];

  if (theme === "sphere") {
    // Sphere theme: distribute nodes on sphere surface using Fibonacci spiral
    const sphereRadius = 12;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < topTags.length; i++) {
      const tag = topTags[i];
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * (i + 0.5) / topTags.length);
      
      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.cos(phi);
      const z = sphereRadius * Math.sin(phi) * Math.sin(theta);
      
      const r = 0.3 + (tagCount[tag] / maxC) * 0.5;

      nodes.push({
        id: tag,
        label: tag,
        count: tagCount[tag],
        position: [x, y, z] as [number, number, number],
        radius: r,
        colorIndex: i,
      });
    }
  } else if (theme === "ocean") {
    // Ocean theme: vertical helix arrangement like a coral reef
    const helixRadius = 8;
    const helixHeight = 20;

    for (let i = 0; i < topTags.length; i++) {
      const tag = topTags[i];
      const frac = i / Math.max(topTags.length - 1, 1);
      const angle = frac * Math.PI * 4;
      const y = (frac - 0.5) * helixHeight;
      const x = helixRadius * Math.cos(angle) * (0.7 + Math.random() * 0.3);
      const z = helixRadius * Math.sin(angle) * (0.7 + Math.random() * 0.3);
      const r = 0.25 + (tagCount[tag] / maxC) * 0.5;

      nodes.push({
        id: tag,
        label: tag,
        count: tagCount[tag],
        position: [x, y, z] as [number, number, number],
        radius: r,
        colorIndex: i,
      });
    }
  } else {
    // Atomic/Cosmos shell-based layout
    const shellConfig = theme === "atomic" 
      ? [
          { maxNodes: 4, radius: 3, tiltY: 0 },
          { maxNodes: 8, radius: 5.5, tiltY: 0.5 },
          { maxNodes: 12, radius: 8.5, tiltY: -0.3 },
          { maxNodes: 16, radius: 12, tiltY: 0.4 },
        ]
      : [
          { maxNodes: 3, radius: 4, tiltY: 0 },
          { maxNodes: 6, radius: 7, tiltY: 0.4 },
          { maxNodes: 10, radius: 11, tiltY: -0.3 },
          { maxNodes: 21, radius: 16, tiltY: 0.6 },
        ];

    let tagIndex = 0;

    for (const shell of shellConfig) {
      const nodesInShell = topTags.slice(tagIndex, tagIndex + shell.maxNodes);
      const count = nodesInShell.length;
      if (count === 0) break;

      for (let i = 0; i < count; i++) {
        const tag = nodesInShell[i];
        const angle = (2 * Math.PI * i) / count;
        const verticalScatter = (Math.random() - 0.5) * (theme === "atomic" ? 0.8 : 1.5);
        const r = theme === "atomic" 
          ? 0.2 + (tagCount[tag] / maxC) * 0.4
          : 0.25 + (tagCount[tag] / maxC) * 0.55;

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

// ─── Comet trail for atomic theme ───
interface CometTrailProps {
  positions: THREE.Vector3[];
  color: string;
}

function CometTrail({ positions, color }: CometTrailProps) {
  const lineRef = useRef<THREE.Line>(null!);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const posArray = new Float32Array(positions.length * 3);
    positions.forEach((pos, i) => {
      posArray[i * 3] = pos.x;
      posArray[i * 3 + 1] = pos.y;
      posArray[i * 3 + 2] = pos.z;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    return geo;
  }, [positions]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });
  }, [color]);

  if (positions.length < 2) return null;

  return <primitive object={new THREE.Line(geometry, material)} />;
}

// ─── Orbiting moons with comet trails (Atomic theme) ───
interface MoonData {
  orbitRadius: number;
  size: number;
  speed: number;
  phase: number;
  tiltX: number;
  tiltZ: number;
}

function OrbitingMoonsWithTrails({ 
  parentRadius, 
  color, 
  glowColor, 
  trailColor,
  count, 
  isDimmed,
  nodeId,
  tagLinks,
  onMoonClick,
}: { 
  parentRadius: number; 
  color: string; 
  glowColor: string; 
  trailColor: string;
  count: number; 
  isDimmed: boolean;
  nodeId: string;
  tagLinks: Record<string, Link[]>;
  onMoonClick: (nodeId: string, moonIdx: number, position: THREE.Vector3) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const trailHistories = useRef<THREE.Vector3[][]>([]);
  const [trails, setTrails] = useState<THREE.Vector3[][]>([]);
  
  const moonData = useMemo(() => {
    const moons: MoonData[] = [];
    const numMoons = Math.min(Math.max(count, 1), 4);
    trailHistories.current = Array(numMoons).fill(null).map(() => []);
    for (let i = 0; i < numMoons; i++) {
      moons.push({
        orbitRadius: parentRadius * (2.2 + i * 0.5),
        size: 0.06 + Math.random() * 0.04,
        speed: (1.2 + Math.random() * 0.8) * (i % 2 === 0 ? 1 : -1),
        phase: (Math.PI * 2 * i) / numMoons,
        tiltX: (Math.random() - 0.5) * 1.0,
        tiltZ: (Math.random() - 0.5) * 0.4,
      });
    }
    return moons;
  }, [parentRadius, count]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const children = groupRef.current.children;
    const t = state.clock.elapsedTime;
    const newTrails: THREE.Vector3[][] = [];
    
    moonData.forEach((moon, i) => {
      if (children[i]) {
        const angle = t * moon.speed + moon.phase;
        const x = Math.cos(angle) * moon.orbitRadius;
        const y = Math.sin(angle) * moon.orbitRadius * Math.sin(moon.tiltX);
        const z = Math.sin(angle) * moon.orbitRadius * Math.cos(moon.tiltX);
        children[i].position.set(x, y, z);
        
        // Update trail history
        const worldPos = new THREE.Vector3();
        children[i].getWorldPosition(worldPos);
        trailHistories.current[i].unshift(worldPos.clone());
        if (trailHistories.current[i].length > 15) {
          trailHistories.current[i].pop();
        }
        newTrails.push([...trailHistories.current[i]]);
      }
    });
    
    // Update trails every few frames for performance
    if (Math.floor(t * 30) % 2 === 0) {
      setTrails(newTrails);
    }
  });

  const moonColor = isDimmed ? "#2a2a35" : color;
  const moonEmissive = isDimmed ? "#1a1a22" : glowColor;
  const moonOpacity = isDimmed ? 0.3 : 0.95;

  return (
    <>
      <group ref={groupRef}>
        {moonData.map((moon, i) => (
          <mesh 
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              const worldPos = new THREE.Vector3();
              e.object.getWorldPosition(worldPos);
              onMoonClick(nodeId, i, worldPos);
            }}
            onPointerOver={() => { document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}
          >
            <sphereGeometry args={[moon.size, 16, 16]} />
            <meshPhysicalMaterial
              color={moonColor}
              emissive={moonEmissive}
              emissiveIntensity={isDimmed ? 0.05 : 0.8}
              metalness={0.2}
              roughness={0.3}
              clearcoat={1.0}
              transparent
              opacity={moonOpacity}
            />
          </mesh>
        ))}
      </group>
      {/* Comet trails */}
      {!isDimmed && trails.map((trail, i) => (
        <CometTrail key={i} positions={trail} color={trailColor} />
      ))}
    </>
  );
}

// ─── Original orbiting moons (Cosmos theme - no trails) ───
function OrbitingMoons({ parentRadius, color, glowColor, count, isDimmed }: { parentRadius: number; color: string; glowColor: string; count: number; isDimmed: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const moonData = useMemo(() => {
    const moons = [];
    const numMoons = Math.min(Math.max(count, 1), 4);
    for (let i = 0; i < numMoons; i++) {
      moons.push({
        orbitRadius: parentRadius * (2.8 + i * 0.7),
        size: 0.04 + Math.random() * 0.04,
        speed: (0.8 + Math.random() * 0.6) * (i % 2 === 0 ? 1 : -1),
        phase: (Math.PI * 2 * i) / numMoons,
        tiltX: (Math.random() - 0.5) * 1.2,
        tiltZ: (Math.random() - 0.5) * 0.6,
      });
    }
    return moons;
  }, [parentRadius, count]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const children = groupRef.current.children;
    const t = state.clock.elapsedTime;
    moonData.forEach((moon, i) => {
      if (children[i]) {
        const angle = t * moon.speed + moon.phase;
        children[i].position.x = Math.cos(angle) * moon.orbitRadius;
        children[i].position.y = Math.sin(angle) * moon.orbitRadius * Math.sin(moon.tiltX);
        children[i].position.z = Math.sin(angle) * moon.orbitRadius * Math.cos(moon.tiltX);
      }
    });
  });

  const moonColor = isDimmed ? "#2a2a35" : color;
  const moonEmissive = isDimmed ? "#1a1a22" : glowColor;
  const moonOpacity = isDimmed ? 0.3 : 0.9;

  return (
    <group ref={groupRef}>
      {moonData.map((moon, i) => (
        <mesh key={i}>
          <sphereGeometry args={[moon.size, 16, 16]} />
          <meshPhysicalMaterial
            color={moonColor}
            emissive={moonEmissive}
            emissiveIntensity={isDimmed ? 0.05 : 0.6}
            metalness={0.3}
            roughness={0.4}
            clearcoat={0.8}
            transparent
            opacity={moonOpacity}
          />
        </mesh>
      ))}
    </group>
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

// ─── 3D Planet Node (Cosmos theme) ───
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
  const groupRef = useRef<THREE.Group>(null!);
  const lensHaloRef = useRef<THREE.Mesh>(null!);
  const currentScale = useRef(1);
  const pulsePhase = useRef(Math.random() * Math.PI * 2);
  const planet = getPlanetColor(node.colorIndex);

  // Distance from black hole center (0,0,0)
  const distFromCenter = Math.sqrt(node.position[0] ** 2 + node.position[1] ** 2 + node.position[2] ** 2);
  // Proximity factor: 1.0 at center, 0.0 at distance >= 12
  const proximity = Math.max(0, 1 - distFromCenter / 12);

  const wobbleAxis = useRef(new THREE.Vector3(
    Math.random() * 0.3 - 0.15,
    1,
    Math.random() * 0.3 - 0.15
  ).normalize());

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.5 : isHovered ? 1.3 : isConnected ? 1.12 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 5, 1);

    const pulse = Math.sin(state.clock.elapsedTime * 1.2 + pulsePhase.current) * 0.03;
    meshRef.current.scale.setScalar(currentScale.current + pulse);
    meshRef.current.rotateOnAxis(wobbleAxis.current, delta * 0.4);

    // Gravitational distortion: stretch node towards center
    if (groupRef.current && proximity > 0.05) {
      const t = state.clock.elapsedTime;
      const stretchAmount = 1 + proximity * 0.25 * (1 + Math.sin(t * 1.5 + pulsePhase.current) * 0.3);
      // Stretch toward center direction
      const dirX = -node.position[0] / (distFromCenter || 1);
      const dirY = -node.position[1] / (distFromCenter || 1);
      const dirZ = -node.position[2] / (distFromCenter || 1);
      // Apply non-uniform scale along the radial direction (approximate with dominant axis)
      const ax = 1 + Math.abs(dirX) * (stretchAmount - 1);
      const ay = 1 + Math.abs(dirY) * (stretchAmount - 1);
      const az = 1 + Math.abs(dirZ) * (stretchAmount - 1);
      groupRef.current.scale.set(ax, ay, az);
    }

    // Lensing halo pulse
    if (lensHaloRef.current && proximity > 0.1) {
      const lp = 1 + Math.sin(state.clock.elapsedTime * 2 + pulsePhase.current) * 0.15;
      lensHaloRef.current.scale.setScalar(lp);
      (lensHaloRef.current.material as THREE.MeshBasicMaterial).opacity = proximity * 0.15;
    }
  });

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
      <group ref={groupRef}>
      {/* Gravitational lensing halo for nearby nodes */}
      {proximity > 0.1 && (
        <mesh ref={lensHaloRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[node.radius * 2.2, 0.03, 16, 64]} />
          <meshBasicMaterial color="#8070ff" transparent opacity={proximity * 0.15} depthWrite={false} />
        </mesh>
      )}
      <AtmosphereShell radius={node.radius * 2.8} color={activeGlow} opacity={isSelected ? 0.2 : isDimmed ? 0.01 : 0.05} />
      <AtmosphereShell radius={node.radius * 1.8} color={activeColor} opacity={isSelected ? 0.3 : isDimmed ? 0.02 : 0.08} />

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

      <OrbitingMoons
        parentRadius={node.radius}
        color={activeRing}
        glowColor={activeGlow}
        count={node.count}
        isDimmed={isDimmed}
      />

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
    </group>
  );
}

// ─── Atom Node (Atomic theme) ───
function AtomNode({
  node,
  isSelected,
  isConnected,
  isHovered,
  isDimmed,
  maxCount,
  onSelect,
  onHover,
  tagLinks,
  onMoonClick,
}: {
  node: Node3D;
  isSelected: boolean;
  isConnected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  maxCount: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  tagLinks: Record<string, Link[]>;
  onMoonClick: (nodeId: string, moonIdx: number, position: THREE.Vector3) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const currentScale = useRef(1);
  const pulsePhase = useRef(Math.random() * Math.PI * 2);
  const atom = getAtomColor(node.colorIndex);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.6 : isHovered ? 1.4 : isConnected ? 1.15 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 6, 1);

    const pulse = Math.sin(state.clock.elapsedTime * 2.5 + pulsePhase.current) * 0.04;
    meshRef.current.scale.setScalar(currentScale.current + pulse);
  });

  const dimColor = "#1a1a22";
  const dimGlow = "#0a0a10";
  const activeColor = isDimmed ? dimColor : atom.core;
  const activeGlow = isDimmed ? dimGlow : atom.glow;
  const trailColor = isDimmed ? "#1a1a22" : atom.trail;

  const emissiveIntensity = isSelected ? 2.0 : isHovered ? 1.2 : isDimmed ? 0.02 : 0.5;
  const sphereOpacity = isSelected ? 1.0 : isDimmed ? 0.4 : 0.85;

  return (
    <group position={node.position}>
      {/* Outer glow */}
      <AtmosphereShell radius={node.radius * 2.2} color={activeGlow} opacity={isSelected ? 0.25 : isDimmed ? 0.01 : 0.08} />
      
      {/* Core sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : node.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[node.radius, 48, 48]} />
        <meshPhysicalMaterial
          color={activeColor}
          emissive={activeGlow}
          emissiveIntensity={emissiveIntensity}
          metalness={0.0}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          transparent
          opacity={sphereOpacity}
        />
      </mesh>

      {/* Electron orbital ring (neon style) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[node.radius * 1.8, 0.008, 8, 64]} />
        <meshBasicMaterial color={activeGlow} transparent opacity={isDimmed ? 0.05 : 0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2.5, 0.5, 0]}>
        <torusGeometry args={[node.radius * 2.2, 0.006, 8, 64]} />
        <meshBasicMaterial color={activeColor} transparent opacity={isDimmed ? 0.03 : 0.25} />
      </mesh>

      {/* Orbiting electrons with comet trails */}
      <OrbitingMoonsWithTrails
        parentRadius={node.radius}
        color={activeColor}
        glowColor={activeGlow}
        trailColor={trailColor}
        count={node.count}
        isDimmed={isDimmed}
        nodeId={node.id}
        tagLinks={tagLinks}
        onMoonClick={onMoonClick}
      />

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, node.radius + 0.35, 0]}
          fontSize={0.2}
          color={isSelected || isHovered ? "#ffffff" : "#e0e0e0"}
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
          fontSize={0.15}
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

  const { curve, lineObj, glowLine } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const offset = mid.clone().normalize().multiplyScalar(0.6);
    mid.add(offset);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(48);
    const weightNorm = weight / maxWeight;

    // Main line - much more visible
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = isHighlighted ? sourceColor : "#505068";
    const opacity = isDimmed ? 0.03 : isHighlighted ? 0.6 : 0.12 + weightNorm * 0.15;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const lineObj = new THREE.Line(geometry, material);

    // Glow line for depth
    const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
    const glowMat = new THREE.LineBasicMaterial({
      color: isHighlighted ? sourceColor : "#6a6a88",
      transparent: true,
      opacity: isDimmed ? 0.01 : isHighlighted ? 0.25 : 0.05 + weightNorm * 0.06,
    });
    const glowLine = new THREE.Line(glowGeo, glowMat);

    return { curve, lineObj, glowLine };
  }, [from, to, isHighlighted, isDimmed, sourceColor, weight, maxWeight]);

  useFrame((state) => {
    if (!pulseRef.current || !isHighlighted) return;
    const t = (state.clock.elapsedTime * 0.3) % 1;
    const pos = curve.getPoint(t);
    pulseRef.current.position.copy(pos);
  });

  return (
    <group ref={groupRef}>
      <primitive object={glowLine} />
      <primitive object={lineObj} />
      {isHighlighted && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color={sourceColor} transparent opacity={0.9} />
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

// ─── Central black hole with accretion disk (Cosmos theme) ───
function BlackHole() {
  const diskRef = useRef<THREE.Mesh>(null!);
  const disk2Ref = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  // Gravitational lensing rings
  const lensRefs = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];
  const photonRingRef = useRef<THREE.Mesh>(null!);
  const distortionRef = useRef<THREE.Mesh>(null!);

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
    // Animate lensing rings - ripple outward with phase offsets
    lensRefs.forEach((ref, i) => {
      if (ref.current) {
        const phase = t * 1.2 + i * 0.8;
        const breathe = 1 + Math.sin(phase) * 0.06;
        ref.current.scale.setScalar(breathe);
        (ref.current.material as THREE.MeshBasicMaterial).opacity =
          (0.08 - i * 0.012) + Math.sin(phase + Math.PI / 3) * 0.03;
        ref.current.rotation.z = t * 0.02 * (i % 2 === 0 ? 1 : -1);
      }
    });
    // Photon ring rotation
    if (photonRingRef.current) {
      photonRingRef.current.rotation.z = t * 0.3;
      const pr = photonRingRef.current.material as THREE.MeshBasicMaterial;
      pr.opacity = 0.25 + Math.sin(t * 3) * 0.1;
    }
    // Distortion sphere shimmer
    if (distortionRef.current) {
      const s = 1 + Math.sin(t * 0.8) * 0.08;
      distortionRef.current.scale.setScalar(s);
      (distortionRef.current.material as THREE.MeshBasicMaterial).opacity = 0.04 + Math.sin(t * 1.2) * 0.02;
    }
  });

  const lensData = [
    { radius: 1.6, thickness: 0.035, color: "#8060ff" },
    { radius: 2.0, thickness: 0.025, color: "#a080ff" },
    { radius: 2.5, thickness: 0.018, color: "#c0a0ff" },
    { radius: 3.1, thickness: 0.012, color: "#d0c0ff" },
    { radius: 3.8, thickness: 0.008, color: "#e0d8ff" },
  ];

  return (
    <group>
      {/* Event horizon core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Gravitational lensing distortion sphere */}
      <mesh ref={distortionRef}>
        <sphereGeometry args={[1.8, 64, 64]} />
        <meshBasicMaterial color="#6040ff" transparent opacity={0.04} depthWrite={false} side={THREE.BackSide} />
      </mesh>

      {/* Inner glow - event horizon edge */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#6040ff" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* Photon ring - bright thin ring at photon sphere */}
      <mesh ref={photonRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.04, 16, 128]} />
        <meshBasicMaterial color="#ffcc66" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* Gravitational lensing rings - concentric halos */}
      {lensData.map((lens, i) => (
        <mesh key={`lens-${i}`} ref={lensRefs[i]} rotation={[Math.PI / 2.1 + i * 0.05, i * 0.03, 0]}>
          <torusGeometry args={[lens.radius, lens.thickness, 16, 256]} />
          <meshBasicMaterial color={lens.color} transparent opacity={0.08 - i * 0.012} depthWrite={false} />
        </mesh>
      ))}

      {/* Accretion disk - primary */}
      <mesh ref={diskRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[2.0, 0.15, 4, 128]} />
        <meshStandardMaterial color="#ff8040" emissive="#ff6020" emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Accretion disk - secondary */}
      <mesh ref={disk2Ref} rotation={[Math.PI / 2.5, 0.3, 0]}>
        <torusGeometry args={[2.8, 0.08, 4, 128]} />
        <meshStandardMaterial color="#a060ff" emissive="#8040e0" emissiveIntensity={0.5} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Central Nucleus (Atomic theme) ───
function AtomNucleus() {
  const groupRef = useRef<THREE.Group>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const protonsRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 3) * 0.08;
      coreRef.current.scale.setScalar(pulse);
    }
    if (protonsRef.current) {
      protonsRef.current.rotation.y = t * 0.3;
      protonsRef.current.rotation.x = Math.sin(t * 0.2) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central glowing core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshPhysicalMaterial
          color="#ff3366"
          emissive="#ff0044"
          emissiveIntensity={1.5}
          metalness={0}
          roughness={0.2}
          clearcoat={1}
        />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial color="#ff6699" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#ff99bb" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      
      {/* Orbiting protons/neutrons */}
      <group ref={protonsRef}>
        {[0, 1, 2, 3].map((i) => {
          const angle = (Math.PI * 2 * i) / 4;
          const r = 0.9;
          return (
            <mesh key={i} position={[Math.cos(angle) * r, Math.sin(angle) * r * 0.3, Math.sin(angle) * r]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshPhysicalMaterial
                color={i % 2 === 0 ? "#00ccff" : "#ff6600"}
                emissive={i % 2 === 0 ? "#0099cc" : "#cc5500"}
                emissiveIntensity={0.8}
                metalness={0}
                roughness={0.3}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ─── Orbital ring guides (Cosmos theme) ───
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

// ─── Electron Shells (Atomic theme) ───
function ElectronShells() {
  const refs = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speeds = [0.05, -0.04, 0.03, -0.025];
    refs.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.y = t * speeds[i];
    });
  });

  const shellData = [
    { radius: 3, tiltX: Math.PI / 2, color: "#00ff88" },
    { radius: 5.5, tiltX: Math.PI / 2 + 0.5, color: "#ff00ff" },
    { radius: 8.5, tiltX: Math.PI / 2 - 0.3, color: "#00ccff" },
    { radius: 12, tiltX: Math.PI / 2 + 0.4, color: "#ffff00" },
  ];

  return (
    <>
      {shellData.map((s, i) => (
        <mesh key={i} ref={refs[i]} rotation={[s.tiltX, 0, 0]}>
          <torusGeometry args={[s.radius, 0.012, 8, 128]} />
          <meshBasicMaterial color={s.color} transparent opacity={0.15} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// ─── Scene Transition Wrapper ───
function SceneTransition({ themeKey, children }: { themeKey: string; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null!);
  const prevTheme = useRef(themeKey);
  const opacity = useRef(1);
  const scale = useRef(1);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (prevTheme.current !== themeKey) {
      opacity.current = 0;
      scale.current = 0.85;
      prevTheme.current = themeKey;
    }
    opacity.current += (1 - opacity.current) * Math.min(delta * 3, 1);
    scale.current += (1 - scale.current) * Math.min(delta * 3, 1);
    groupRef.current.scale.setScalar(scale.current);
    groupRef.current.traverse((child) => {
      if ((child as any).material) {
        const mat = (child as any).material;
        if (mat._baseOpacity === undefined) mat._baseOpacity = mat.opacity ?? 1;
        mat.opacity = mat._baseOpacity * opacity.current;
      }
    });
  });

  return <group ref={groupRef}>{children}</group>;
}

// ─── Jellyfish Node (Ocean theme) ───
function JellyfishNode({
  node, isSelected, isConnected, isHovered, isDimmed, maxCount, onSelect, onHover,
}: {
  node: Node3D; isSelected: boolean; isConnected: boolean; isHovered: boolean;
  isDimmed: boolean; maxCount: number;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const tentaclesRef = useRef<THREE.Group>(null!);
  const currentScale = useRef(1);
  const pulsePhase = useRef(Math.random() * Math.PI * 2);
  const oceanColor = getOceanColor(node.colorIndex);

  const tentacleCount = 6;
  const segCount = 10;
  const tentacleLen = node.radius * 3.5;

  const tentacleData = useMemo(() => {
    const data: { lines: THREE.Line; angle: number }[] = [];
    for (let t = 0; t < tentacleCount; t++) {
      const angle = (Math.PI * 2 * t) / tentacleCount + pulsePhase.current;
      const points: THREE.Vector3[] = [];
      for (let s = 0; s <= segCount; s++) {
        const frac = s / segCount;
        points.push(new THREE.Vector3(
          Math.cos(angle) * node.radius * 0.4 * (1 - frac * 0.5),
          -frac * tentacleLen,
          Math.sin(angle) * node.radius * 0.4 * (1 - frac * 0.5),
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: isDimmed ? "#1a1a22" : oceanColor.tentacle,
        transparent: true,
        opacity: isDimmed ? 0.08 : 0.35,
      });
      data.push({ lines: new THREE.Line(geo, mat), angle });
    }
    return data;
  }, [node.radius, isDimmed, oceanColor.tentacle]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const target = isSelected ? 1.6 : isHovered ? 1.3 : isConnected ? 1.1 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 5, 1);

    // Jellyfish breathing
    const breathe = Math.sin(t * 1.2 + pulsePhase.current) * 0.08;
    meshRef.current.scale.set(
      currentScale.current + breathe,
      currentScale.current - breathe * 0.5,
      currentScale.current + breathe,
    );

    // Animate tentacles
    if (tentaclesRef.current) {
      tentaclesRef.current.children.forEach((child, idx) => {
        if (child instanceof THREE.Line) {
          const geo = child.geometry;
          const posAttr = geo.getAttribute("position");
          const angle = tentacleData[idx]?.angle || 0;
          for (let s = 0; s <= segCount; s++) {
            const frac = s / segCount;
            const wave = Math.sin(t * 1.5 + frac * 3.5 + angle) * frac * node.radius * 0.5;
            const wave2 = Math.cos(t * 1.1 + frac * 2.8 + angle * 1.4) * frac * node.radius * 0.3;
            posAttr.setXYZ(s,
              Math.cos(angle) * node.radius * 0.4 * (1 - frac * 0.5) + wave,
              -frac * tentacleLen - Math.sin(t * 0.8 + angle) * frac * 0.3,
              Math.sin(angle) * node.radius * 0.4 * (1 - frac * 0.5) + wave2,
            );
          }
          posAttr.needsUpdate = true;
        }
      });
    }
  });

  const dimColor = "#1a1a22";
  const dimGlow = "#0a0a10";
  const activeColor = isDimmed ? dimColor : oceanColor.core;
  const activeGlow = isDimmed ? dimGlow : oceanColor.glow;
  const emissiveIntensity = isSelected ? 2.0 : isHovered ? 1.2 : isDimmed ? 0.02 : 0.5;

  return (
    <group position={node.position}>
      {/* Bioluminescent outer glow */}
      <mesh>
        <sphereGeometry args={[node.radius * 2.5, 32, 32]} />
        <meshBasicMaterial color={activeGlow} transparent opacity={isSelected ? 0.15 : isDimmed ? 0.01 : 0.06} depthWrite={false} />
      </mesh>

      {/* Jellyfish bell (dome) */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : node.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[node.radius, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshPhysicalMaterial
          color={activeColor}
          emissive={activeGlow}
          emissiveIntensity={emissiveIntensity}
          metalness={0}
          roughness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          transmission={isDimmed ? 0 : 0.6}
          thickness={0.8}
          transparent
          opacity={isDimmed ? 0.4 : 0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner bioluminescent core */}
      <mesh>
        <sphereGeometry args={[node.radius * 0.4, 16, 16]} />
        <meshBasicMaterial color={activeColor} transparent opacity={isDimmed ? 0.05 : isSelected ? 0.8 : 0.4} />
      </mesh>

      {/* Tentacles */}
      <group ref={tentaclesRef}>
        {tentacleData.map((td, i) => (
          <primitive key={i} object={td.lines} />
        ))}
      </group>

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, node.radius + 0.5, 0]}
          fontSize={0.22}
          color={isSelected || isHovered ? "#ffffff" : "#c0e8ff"}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          outlineWidth={0.02}
          outlineColor="#001020"
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
          outlineColor="#001020"
        >
          {String(node.count)}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Ocean Edge (flowing current) ───
function OceanEdgeLine({ from, to, weight, maxWeight, isHighlighted, isDimmed, sourceColor, targetColor }: {
  from: [number, number, number]; to: [number, number, number];
  weight: number; maxWeight: number; isHighlighted: boolean; isDimmed: boolean;
  sourceColor: string; targetColor: string;
}) {
  const pulseRef = useRef<THREE.Mesh>(null!);

  const { curve, lineObj, glowLine } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 1.5;
    mid.x += (Math.random() - 0.5) * 2;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(48);
    const weightNorm = weight / maxWeight;

    const color = isHighlighted ? sourceColor : "#2a4060";
    const opacity = isDimmed ? 0.02 : isHighlighted ? 0.55 : 0.1 + weightNorm * 0.12;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const lineObj = new THREE.Line(geometry, material);

    const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
    const glowMat = new THREE.LineBasicMaterial({
      color: isHighlighted ? sourceColor : "#3a5575",
      transparent: true,
      opacity: isDimmed ? 0.01 : isHighlighted ? 0.2 : 0.04 + weightNorm * 0.05,
    });
    const glowLine = new THREE.Line(glowGeo, glowMat);

    return { curve, lineObj, glowLine };
  }, [from, to, isHighlighted, isDimmed, sourceColor, weight, maxWeight]);

  useFrame((state) => {
    if (!pulseRef.current || !isHighlighted) return;
    const t = (state.clock.elapsedTime * 0.25) % 1;
    const pos = curve.getPoint(t);
    pulseRef.current.position.copy(pos);
  });

  return (
    <group>
      <primitive object={glowLine} />
      <primitive object={lineObj} />
      {isHighlighted && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color={sourceColor} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// ─── Ocean Bubbles (rising particles) ───
function OceanBubbles() {
  const count = 400;
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const posAttr = ref.current.geometry.getAttribute("position");
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      let y = posAttr.getY(i);
      y += 0.008 + Math.sin(t + i) * 0.003;
      if (y > 25) y = -25;
      posAttr.setY(i, y);
      const x = posAttr.getX(i) + Math.sin(t * 0.3 + i * 0.1) * 0.002;
      posAttr.setX(i, x);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#60c0e0" transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

// ─── Deep Sea Vent (central element) ───
function DeepSeaVent() {
  const coreRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.5) * 0.1;
      coreRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 2) * 0.04;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshPhysicalMaterial color="#00e5ff" emissive="#00b8d4" emissiveIntensity={2} metalness={0} roughness={0.2} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="#004060" transparent opacity={0.04} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Ocean Scene ───
function OceanScene({
  nodes, edges, selectedTag, hoveredTag, connectedTags, maxWeight, maxCount, onSelect, onHover,
  forceBrightNodes = null, pathEdgeKeys = null,
}: {
  nodes: Node3D[]; edges: Edge3D[];
  selectedTag: string | null; hoveredTag: string | null; connectedTags: Set<string>;
  maxWeight: number; maxCount: number;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void;
  forceBrightNodes?: Set<string> | null; pathEdgeKeys?: Set<string> | null;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 15, 0]} intensity={1.5} color="#80d0ff" />
      <pointLight position={[-10, -10, 5]} intensity={0.8} color="#00e5ff" />
      <pointLight position={[10, 5, -10]} intensity={0.6} color="#ea80fc" />
      <pointLight position={[0, -15, 0]} intensity={0.4} color="#69f0ae" />

      <DeepSeaVent />
      <OceanBubbles />

      {edges.map((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        const isHighlighted = selectedTag === edge.source || selectedTag === edge.target ||
          hoveredTag === edge.source || hoveredTag === edge.target;
        const isDimmed = !!(selectedTag || hoveredTag) && !isHighlighted;
        return (
          <OceanEdgeLine
            key={`${edge.source}-${edge.target}`}
            from={s.position} to={t.position}
            weight={edge.weight} maxWeight={maxWeight}
            isHighlighted={isHighlighted} isDimmed={isDimmed}
            sourceColor={getOceanColor(s.colorIndex).core}
            targetColor={getOceanColor(t.colorIndex).core}
          />
        );
      })}

      {nodes.map((node) => (
        <Float
          key={node.id}
          speed={selectedTag === node.id ? 2.0 : 0.8}
          rotationIntensity={0.01}
          floatIntensity={selectedTag === node.id ? 0.4 : 0.2}
          floatingRange={[-0.1, 0.1]}
        >
          <JellyfishNode
            node={node}
            isSelected={selectedTag === node.id}
            isConnected={connectedTags.has(node.id)}
            isHovered={hoveredTag === node.id}
            isDimmed={forceBrightNodes ? !forceBrightNodes.has(node.id) : (!!selectedTag && selectedTag !== node.id)}
            maxCount={maxCount}
            onSelect={onSelect}
            onHover={onHover}
          />
        </Float>
      ))}

      <OrbitControls
        enableDamping dampingFactor={0.04}
        rotateSpeed={0.4} zoomSpeed={0.6}
        minDistance={8} maxDistance={40}
        enablePan={false}
        autoRotate autoRotateSpeed={0.1}
      />
    </>
  );
}


function CosmosScene({
  nodes, edges, selectedTag, hoveredTag, connectedTags, maxWeight, maxCount, onSelect, onHover,
  forceBrightNodes = null, pathEdgeKeys = null,
}: {
  nodes: Node3D[]; edges: Edge3D[];
  selectedTag: string | null; hoveredTag: string | null; connectedTags: Set<string>;
  maxWeight: number; maxCount: number;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void;
  forceBrightNodes?: Set<string> | null; pathEdgeKeys?: Set<string> | null;
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
        const isPathEdge = pathEdgeKeys?.has(`${edge.source}|||${edge.target}`) || pathEdgeKeys?.has(`${edge.target}|||${edge.source}`);
        const isHighlighted = !!isPathEdge ||
          selectedTag === edge.source || selectedTag === edge.target ||
          hoveredTag === edge.source || hoveredTag === edge.target;
        const isDimmed = forceBrightNodes
          ? (!forceBrightNodes.has(edge.source) && !forceBrightNodes.has(edge.target))
          : (!!(selectedTag || hoveredTag) && !isHighlighted);
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
            isDimmed={forceBrightNodes ? !forceBrightNodes.has(node.id) : (!!selectedTag && selectedTag !== node.id)}
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

// ─── Atomic Scene ───
function AtomicScene({
  nodes, edges, selectedTag, hoveredTag, connectedTags, maxWeight, maxCount,
  tagLinks, onSelect, onHover, onMoonClick,
  forceBrightNodes = null, pathEdgeKeys = null,
}: {
  nodes: Node3D[]; edges: Edge3D[];
  selectedTag: string | null; hoveredTag: string | null; connectedTags: Set<string>;
  maxWeight: number; maxCount: number;
  tagLinks: Record<string, Link[]>;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void;
  onMoonClick: (nodeId: string, moonIdx: number, position: THREE.Vector3) => void;
  forceBrightNodes?: Set<string> | null; pathEdgeKeys?: Set<string> | null;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#00ff88" />
      <pointLight position={[-10, -5, -5]} intensity={1.0} color="#ff00ff" />
      <pointLight position={[0, 8, -10]} intensity={0.8} color="#00ccff" />
      <pointLight position={[5, -5, 8]} intensity={0.6} color="#ffff00" />

      <AtomNucleus />
      <ElectronShells />
      <Particles />

      {edges.map((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        const isPathEdge = pathEdgeKeys?.has(`${edge.source}|||${edge.target}`) || pathEdgeKeys?.has(`${edge.target}|||${edge.source}`);
        const isHighlighted = !!isPathEdge ||
          selectedTag === edge.source || selectedTag === edge.target ||
          hoveredTag === edge.source || hoveredTag === edge.target;
        const isDimmed = forceBrightNodes
          ? (!forceBrightNodes.has(edge.source) && !forceBrightNodes.has(edge.target))
          : (!!(selectedTag || hoveredTag) && !isHighlighted);
        return (
          <EdgeLine
            key={`${edge.source}-${edge.target}`}
            from={s.position}
            to={t.position}
            weight={edge.weight}
            maxWeight={maxWeight}
            isHighlighted={isHighlighted}
            isDimmed={isDimmed}
            sourceColor={getAtomColor(s.colorIndex).core}
            targetColor={getAtomColor(t.colorIndex).core}
          />
        );
      })}

      {nodes.map((node) => (
        <Float
          key={node.id}
          speed={selectedTag === node.id ? 3.0 : 1.5}
          rotationIntensity={0}
          floatIntensity={selectedTag === node.id ? 0.4 : 0.15}
          floatingRange={[-0.04, 0.04]}
        >
          <AtomNode
            node={node}
            isSelected={selectedTag === node.id}
            isConnected={connectedTags.has(node.id)}
            isHovered={hoveredTag === node.id}
            isDimmed={forceBrightNodes ? !forceBrightNodes.has(node.id) : (!!selectedTag && selectedTag !== node.id)}
            maxCount={maxCount}
            onSelect={onSelect}
            onHover={onHover}
            tagLinks={tagLinks}
            onMoonClick={onMoonClick}
          />
        </Float>
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.9}
        minDistance={5}
        maxDistance={30}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  );
}

// ─── Sphere Node (Sphere theme) ───
function SphereNode({
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
  const glowRef = useRef<THREE.Mesh>(null!);
  const currentScale = useRef(1);
  const pulsePhase = useRef(Math.random() * Math.PI * 2);
  const sphereColor = getSphereColor(node.colorIndex);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.8 : isHovered ? 1.5 : isConnected ? 1.2 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 6, 1);

    const pulse = Math.sin(state.clock.elapsedTime * 1.8 + pulsePhase.current) * 0.05;
    meshRef.current.scale.setScalar(currentScale.current + pulse);
    
    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(state.clock.elapsedTime * 2 + pulsePhase.current) * 0.1;
      glowRef.current.scale.setScalar(glowPulse);
    }
  });

  // Particle system for selected node
  const particleCount = 24;
  const particlesRef = useRef<THREE.Points>(null!);
  const particleData = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);
    const offsets = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = node.radius * (1.5 + Math.random() * 1.5);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      speeds[i] = 0.3 + Math.random() * 0.7;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, offsets };
  }, [node.radius]);

  // Orbiting ring refs
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const ring3Ref = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.8 : isHovered ? 1.5 : isConnected ? 1.2 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 6, 1);

    const pulse = Math.sin(state.clock.elapsedTime * 1.8 + pulsePhase.current) * 0.05;
    meshRef.current.scale.setScalar(currentScale.current + pulse);
    
    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(state.clock.elapsedTime * 2 + pulsePhase.current) * 0.1;
      glowRef.current.scale.setScalar(glowPulse);
    }

    // Animate particles when selected
    if (particlesRef.current && isSelected) {
      const geo = particlesRef.current.geometry;
      const posAttr = geo.getAttribute("position");
      const t = state.clock.elapsedTime;
      for (let i = 0; i < particleCount; i++) {
        const speed = particleData.speeds[i];
        const offset = particleData.offsets[i];
        const angle = t * speed + offset;
        const r = node.radius * (1.5 + Math.sin(t * speed * 0.5 + offset) * 0.8);
        const phi = Math.acos(Math.sin(angle * 0.7 + offset));
        posAttr.setXYZ(
          i,
          r * Math.sin(phi) * Math.cos(angle),
          r * Math.sin(phi) * Math.sin(angle),
          r * Math.cos(phi)
        );
      }
      posAttr.needsUpdate = true;
    }

    // Animate orbiting rings when selected
    if (isSelected) {
      if (ring1Ref.current) ring1Ref.current.rotation.z = state.clock.elapsedTime * 0.8;
      if (ring2Ref.current) ring2Ref.current.rotation.x = state.clock.elapsedTime * 0.6;
      if (ring3Ref.current) ring3Ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  const dimColor = "#2a2a35";
  const dimGlow = "#1a1a22";
  const activeColor = isDimmed ? dimColor : sphereColor.core;
  const activeGlow = isDimmed ? dimGlow : sphereColor.glow;

  const emissiveIntensity = isSelected ? 1.8 : isHovered ? 1.2 : isDimmed ? 0.02 : 0.4;
  const sphereOpacity = isSelected ? 1.0 : isDimmed ? 0.4 : 0.9;

  return (
    <group position={node.position}>
      {/* Outer glow layers for 3D depth effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[node.radius * 2.5, 32, 32]} />
        <meshBasicMaterial color={activeGlow} transparent opacity={isSelected ? 0.2 : isDimmed ? 0.01 : 0.06} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.radius * 1.8, 32, 32]} />
        <meshBasicMaterial color={activeColor} transparent opacity={isSelected ? 0.25 : isDimmed ? 0.02 : 0.1} depthWrite={false} />
      </mesh>

      {/* Orbiting selection rings */}
      {isSelected && (
        <>
          <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[node.radius * 2.2, 0.02, 8, 64]} />
            <meshBasicMaterial color={sphereColor.edge} transparent opacity={0.6} />
          </mesh>
          <mesh ref={ring2Ref} rotation={[0, Math.PI / 4, Math.PI / 6]}>
            <torusGeometry args={[node.radius * 2.6, 0.015, 8, 64]} />
            <meshBasicMaterial color={sphereColor.glow} transparent opacity={0.4} />
          </mesh>
          <mesh ref={ring3Ref} rotation={[Math.PI / 2, Math.PI / 5, 0]}>
            <torusGeometry args={[node.radius * 3.0, 0.01, 8, 64]} />
            <meshBasicMaterial color={activeColor} transparent opacity={0.3} />
          </mesh>
        </>
      )}

      {/* Particle burst when selected */}
      {isSelected && (
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={particleData.positions}
              count={particleCount}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color={sphereColor.edge}
            size={0.08}
            transparent
            opacity={0.8}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
      
      {/* Core sphere with glass-like material */}
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
          metalness={0.3}
          roughness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          transmission={isDimmed ? 0 : 0.3}
          thickness={0.5}
          transparent
          opacity={sphereOpacity}
        />
      </mesh>

      {/* Inner highlight for 3D depth */}
      <mesh position={[node.radius * -0.3, node.radius * 0.3, node.radius * 0.3]}>
        <sphereGeometry args={[node.radius * 0.2, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={isDimmed ? 0.02 : 0.3} />
      </mesh>

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, node.radius + 0.45, 0]}
          fontSize={0.24}
          color={isSelected || isHovered ? "#ffffff" : "#e4e4e7"}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {node.label}
        </Text>
        <Text
          position={[0, 0, 0]}
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {String(node.count)}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Enhanced Edge for Sphere theme with glow ───
function SphereEdgeLine({
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
  const glowRef = useRef<THREE.Line>(null!);

  const { curve, lineObj, glowLine } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    // Arc towards center for sphere layout
    const toCenter = mid.clone().normalize().multiplyScalar(-2);
    mid.add(toCenter);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(64);
    
    // Main line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const weightNorm = weight / maxWeight;
    const color = isHighlighted ? sourceColor : "#5a5a78";
    const opacity = isDimmed ? 0.03 : isHighlighted ? 0.65 : 0.18 + weightNorm * 0.15;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const lineObj = new THREE.Line(geometry, material);
    
    // Glow line (thicker, more transparent)
    const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
    const glowMat = new THREE.LineBasicMaterial({ 
      color: isHighlighted ? sourceColor : "#777799", 
      transparent: true, 
      opacity: isDimmed ? 0.01 : isHighlighted ? 0.3 : 0.07 + weightNorm * 0.06
    });
    const glowLine = new THREE.Line(glowGeo, glowMat);
    
    return { curve, lineObj, glowLine };
  }, [from, to, isHighlighted, isDimmed, sourceColor, weight, maxWeight]);

  useFrame((state) => {
    if (!pulseRef.current || !isHighlighted) return;
    const t = (state.clock.elapsedTime * 0.4) % 1;
    const pos = curve.getPoint(t);
    pulseRef.current.position.copy(pos);
    const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
    pulseRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef}>
      <primitive object={glowLine} />
      <primitive object={lineObj} />
      {isHighlighted && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color={sourceColor} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

// ─── Sphere Grid (wireframe sphere for reference) ───
function SphereGrid() {
  const ref = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[12, 32, 32]} />
      <meshBasicMaterial 
        color="#4fc3f7" 
        wireframe 
        transparent 
        opacity={0.06} 
      />
    </mesh>
  );
}

// ─── Central Core for Sphere theme ───
function SphereCore() {
  const coreRef = useRef<THREE.Mesh>(null!);
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const ring3Ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2) * 0.08;
      coreRef.current.scale.setScalar(pulse);
    }
    if (ring1Ref.current) ring1Ref.current.rotation.x = t * 0.5;
    if (ring2Ref.current) ring2Ref.current.rotation.y = t * 0.4;
    if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.3;
  });

  return (
    <group>
      {/* Glowing core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshPhysicalMaterial
          color="#4fc3f7"
          emissive="#29b6f6"
          emissiveIntensity={1.5}
          metalness={0}
          roughness={0.2}
          clearcoat={1}
        />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#81d4fa" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial color="#b3e5fc" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      
      {/* Orbiting rings for 3D effect */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 8, 64]} />
        <meshBasicMaterial color="#4fc3f7" transparent opacity={0.3} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3, 0.015, 8, 64]} />
        <meshBasicMaterial color="#ba68c8" transparent opacity={0.25} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[3.5, 0.01, 8, 64]} />
        <meshBasicMaterial color="#81c784" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// ─── Sphere Scene ───
function SphereScene({
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
      <ambientLight intensity={0.3} />
      <pointLight position={[20, 20, 20]} intensity={2.5} color="#ffffff" />
      <pointLight position={[-20, -15, -10]} intensity={1.5} color="#4fc3f7" />
      <pointLight position={[0, 15, -20]} intensity={1.2} color="#ba68c8" />
      <pointLight position={[15, -10, 15]} intensity={1.0} color="#81c784" />
      <directionalLight position={[0, 10, 10]} intensity={0.5} />

      <SphereCore />
      <SphereGrid />
      <Particles />

      {edges.map((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        const isPathEdge = pathEdgeKeys?.has(`${edge.source}|||${edge.target}`) || pathEdgeKeys?.has(`${edge.target}|||${edge.source}`);
        const isHighlighted = !!isPathEdge ||
          selectedTag === edge.source || selectedTag === edge.target ||
          hoveredTag === edge.source || hoveredTag === edge.target;
        const isDimmed = forceBrightNodes
          ? (!forceBrightNodes.has(edge.source) && !forceBrightNodes.has(edge.target))
          : (!!(selectedTag || hoveredTag) && !isHighlighted);
        return (
          <SphereEdgeLine
            key={`${edge.source}-${edge.target}`}
            from={s.position}
            to={t.position}
            weight={edge.weight}
            maxWeight={maxWeight}
            isHighlighted={isHighlighted}
            isDimmed={isDimmed}
            sourceColor={getSphereColor(s.colorIndex).core}
            targetColor={getSphereColor(t.colorIndex).core}
          />
        );
      })}

      {nodes.map((node) => (
        <Float
          key={node.id}
          speed={selectedTag === node.id ? 2.5 : 1.0}
          rotationIntensity={0.02}
          floatIntensity={selectedTag === node.id ? 0.3 : 0.1}
          floatingRange={[-0.05, 0.05]}
        >
          <SphereNode
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
        dampingFactor={0.05}
        rotateSpeed={0.4}
        zoomSpeed={0.7}
        minDistance={8}
        maxDistance={40}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </>
  );
}

// ─── Color Legend ───
function ColorLegend({ nodes, maxCount, theme }: { nodes: Node3D[]; maxCount: number; theme: "cosmos" | "atomic" | "sphere" | "ocean" }) {
  const colors = theme === "cosmos" ? PLANET_COLORS : theme === "atomic" ? ATOM_COLORS : theme === "ocean" ? OCEAN_COLORS : SPHERE_COLORS;
  const themeName = theme === "cosmos" ? "🪐 Cosmos" : theme === "atomic" ? "⚛️ Atomic" : theme === "ocean" ? "🌊 Ocean" : "🌐 Sphere";
  
  return (
    <div className="absolute top-3 right-3 bg-background/85 backdrop-blur-md rounded-lg border border-border/50 p-3 space-y-2.5 max-w-[180px] animate-in fade-in slide-in-from-right-3 duration-500 pointer-events-auto">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {themeName} Legend
      </p>

      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground font-medium">Node Size = Link Count</p>
        <div className="flex items-end gap-1.5 h-5">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
          <div className="w-4 h-4 rounded-full bg-muted-foreground/60" />
          <span className="text-[8px] text-muted-foreground ml-1">few → many</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground font-medium">Color = Tag Group</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.core, boxShadow: `0 0 4px ${c.glow}` }} />
              <span className="text-[8px] text-muted-foreground truncate">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {theme === "cosmos" ? (
        <div className="space-y-0.5">
          <p className="text-[9px] text-muted-foreground font-medium">Rings = Connections</p>
          <p className="text-[8px] text-muted-foreground/70">Brighter rings = more active</p>
        </div>
      ) : theme === "atomic" ? (
        <div className="space-y-0.5">
          <p className="text-[9px] text-muted-foreground font-medium">Electrons = Sub-links</p>
          <p className="text-[8px] text-muted-foreground/70">Click electrons for previews</p>
        </div>
      ) : theme === "ocean" ? (
        <div className="space-y-0.5">
          <p className="text-[9px] text-muted-foreground font-medium">Jellyfish = Tag clusters</p>
          <p className="text-[8px] text-muted-foreground/70">Tentacles sway with currents</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="text-[9px] text-muted-foreground font-medium">Surface Layout</p>
          <p className="text-[8px] text-muted-foreground/70">Nodes on sphere surface</p>
        </div>
      )}

      <div className="space-y-0.5">
        <p className="text-[9px] text-muted-foreground font-medium">Edges = Co-occurrence</p>
        <p className="text-[8px] text-muted-foreground/70">Tags appearing together on links</p>
      </div>
    </div>
  );
}

// ─── Moon Preview Popover ───
function MoonPreviewPopover({
  nodeId,
  tagLinks,
  onClose,
  onSelectTag,
}: {
  nodeId: string;
  tagLinks: Record<string, Link[]>;
  onClose: () => void;
  onSelectTag: (tag: string) => void;
}) {
  const links = tagLinks[nodeId]?.slice(0, 3) || [];
  
  return (
    <div className="absolute top-3 left-3 bg-background/95 backdrop-blur-md rounded-lg border border-border/60 p-3 max-w-[240px] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto z-50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-primary text-primary animate-pulse" />
          {nodeId}
        </p>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      {links.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No links found</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((link, i) => (
            <a
              key={link.id}
              href={link.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium truncate group-hover:text-primary transition-colors">
                  {link.title || "Untitled"}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">{link.domain}</p>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 h-6 text-[10px]"
        onClick={() => onSelectTag(nodeId)}
      >
        View all {tagLinks[nodeId]?.length || 0} links →
      </Button>
    </div>
  );
}

// ─── Main Export ───
interface KnowledgeGraph3DProps {
  links: Link[];
  isLoading: boolean;
  theme?: "cosmos" | "atomic" | "sphere" | "ocean";
}

export function KnowledgeGraph3D({ links, isLoading, theme = "cosmos" }: KnowledgeGraph3DProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [moonPreview, setMoonPreview] = useState<{ nodeId: string; moonIdx: number } | null>(null);

  const { nodes, edges, tagLinks } = useMemo(() => buildGraph3D(links, theme), [links, theme]);
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

  const handleMoonClick = useCallback((nodeId: string, moonIdx: number, position: THREE.Vector3) => {
    setMoonPreview({ nodeId, moonIdx });
  }, []);

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
              camera={{ position: theme === "atomic" ? [0, 6, 20] : theme === "sphere" ? [0, 10, 28] : theme === "ocean" ? [0, 5, 25] : [0, 8, 25], fov: 50 }}
              dpr={[1, 2]}
              style={{ background: "transparent" }}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              onPointerMissed={() => { setSelectedTag(null); setMoonPreview(null); }}
            >
              <fog attach="fog" args={[
                theme === "atomic" ? "#050510" : theme === "sphere" ? "#080818" : theme === "ocean" ? "#001525" : "#09090b", 
                theme === "atomic" ? 25 : theme === "sphere" ? 20 : theme === "ocean" ? 15 : 30, 
                theme === "atomic" ? 45 : theme === "sphere" ? 50 : theme === "ocean" ? 50 : 55
              ]} />
              <SceneTransition themeKey={theme}>
                {theme === "cosmos" ? (
                  <CosmosScene
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
                ) : theme === "atomic" ? (
                  <AtomicScene
                    nodes={nodes}
                    edges={edges}
                    selectedTag={selectedTag}
                    hoveredTag={hoveredTag}
                    connectedTags={connectedTags}
                    maxWeight={maxWeight}
                    maxCount={maxCount}
                    tagLinks={tagLinks}
                    onSelect={setSelectedTag}
                    onHover={setHoveredTag}
                    onMoonClick={handleMoonClick}
                  />
                ) : theme === "ocean" ? (
                  <OceanScene
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
                ) : (
                  <SphereScene
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
                )}
              </SceneTransition>
            </Canvas>
          </div>

          {/* Color Legend */}
          <ColorLegend nodes={nodes} maxCount={maxCount} theme={theme} />

          {/* Moon Preview Popover (Atomic theme) */}
          {moonPreview && theme === "atomic" && (
            <MoonPreviewPopover
              nodeId={moonPreview.nodeId}
              tagLinks={tagLinks}
              onClose={() => setMoonPreview(null)}
              onSelectTag={(tag) => { setSelectedTag(tag); setMoonPreview(null); }}
            />
          )}

          {/* Controls hint */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border/40 animate-in fade-in duration-500">
            <RotateCcw className="h-3 w-3" />
            Drag to orbit · Scroll to zoom · Click nodes
            {theme === "atomic" && " · Click electrons"}{theme === "ocean" && " · Watch the jellyfish"}
          </div>

          {/* Hovered tag tooltip */}
          {hoveredTag && !selectedTag && (
            <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/60 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ 
                  background: theme === "cosmos" 
                    ? getPlanetColor(nodes.find(n => n.id === hoveredTag)?.colorIndex || 0).core
                    : theme === "atomic"
                    ? getAtomColor(nodes.find(n => n.id === hoveredTag)?.colorIndex || 0).core
                    : theme === "ocean"
                    ? getOceanColor(nodes.find(n => n.id === hoveredTag)?.colorIndex || 0).core
                    : getSphereColor(nodes.find(n => n.id === hoveredTag)?.colorIndex || 0).core
                }} />
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
                    const color = tagNode 
                      ? (theme === "cosmos" ? getPlanetColor(tagNode.colorIndex).core : theme === "atomic" ? getAtomColor(tagNode.colorIndex).core : theme === "ocean" ? getOceanColor(tagNode.colorIndex).core : getSphereColor(tagNode.colorIndex).core)
                      : undefined;
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
