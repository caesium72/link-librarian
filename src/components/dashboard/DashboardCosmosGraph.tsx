import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text, Billboard } from "@react-three/drei";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Network } from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import * as THREE from "three";

// ─── Color palette ───
const PLANET_COLORS = [
  { core: "#e8a838", glow: "#f5d070", ring: "#d4a030" },
  { core: "#6b8cff", glow: "#a0b4ff", ring: "#4a6bef" },
  { core: "#ff6b6b", glow: "#ff9e9e", ring: "#e04545" },
  { core: "#50d890", glow: "#80f0b0", ring: "#30b870" },
  { core: "#c478ff", glow: "#daa0ff", ring: "#a050e0" },
  { core: "#ff8c42", glow: "#ffb880", ring: "#e07020" },
  { core: "#42d4f4", glow: "#80e8ff", ring: "#20b0d4" },
  { core: "#ff6eb4", glow: "#ffa0d0", ring: "#e04898" },
];

interface Link {
  tags?: string[] | null;
  content_type?: string | null;
}

interface GNode {
  id: string;
  label: string;
  count: number;
  pos: [number, number, number];
  radius: number;
  ci: number;
}

interface GEdge {
  source: string;
  target: string;
  weight: number;
}

function buildGraph(links: Link[]): { nodes: GNode[]; edges: GEdge[] } {
  const tc: Record<string, number> = {};
  const co: Record<string, number> = {};

  for (const l of links) {
    const tags = l.tags || [];
    for (const t of tags) tc[t] = (tc[t] || 0) + 1;
    for (let i = 0; i < tags.length; i++)
      for (let j = i + 1; j < tags.length; j++) {
        const k = [tags[i], tags[j]].sort().join("|||");
        co[k] = (co[k] || 0) + 1;
      }
  }

  const top = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 30);
  if (top.length === 0) return { nodes: [], edges: [] };

  const maxC = top[0][1];
  const topSet = new Set(top.map(([t]) => t));

  // Shell layout like the cosmos theme
  const shells = [
    { max: 3, r: 3, tilt: 0 },
    { max: 6, r: 5.5, tilt: 0.4 },
    { max: 9, r: 8.5, tilt: -0.3 },
    { max: 12, r: 12, tilt: 0.6 },
  ];

  const nodes: GNode[] = [];
  let idx = 0;
  for (const shell of shells) {
    const batch = top.slice(idx, idx + shell.max);
    if (batch.length === 0) break;
    for (let i = 0; i < batch.length; i++) {
      const [tag, count] = batch[i];
      const angle = (2 * Math.PI * i) / batch.length;
      const scatter = (Math.random() - 0.5) * 1.2;
      const r = 0.2 + (count / maxC) * 0.45;
      nodes.push({
        id: tag,
        label: tag,
        count,
        pos: [
          shell.r * Math.cos(angle),
          shell.r * Math.sin(angle) * Math.sin(shell.tilt) + scatter,
          shell.r * Math.sin(angle) * Math.cos(shell.tilt),
        ],
        radius: r,
        ci: idx + i,
      });
    }
    idx += batch.length;
  }

  const edges: GEdge[] = Object.entries(co)
    .filter(([k]) => { const [a, b] = k.split("|||"); return topSet.has(a) && topSet.has(b); })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([k, w]) => { const [s, t] = k.split("|||"); return { source: s, target: t, weight: w }; });

  return { nodes, edges };
}

// ─── Starfield ───
function Starfield() {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return arr;
  }, []);

  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.005;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={400} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#ffffff" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

// ─── Saturn Ring ───
function Ring({ radius, color, opacity, tiltX, tiltZ, speed }: {
  radius: number; color: string; opacity: number; tiltX: number; tiltZ: number; speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.x = tiltX + Math.sin(s.clock.elapsedTime * speed * 0.3) * 0.05;
    ref.current.rotation.z = tiltZ;
    ref.current.rotation.y += speed * 0.003;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.012, 4, 96]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} emissive={color} emissiveIntensity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Atmosphere Glow ───
function Atmosphere({ radius, color, opacity }: { radius: number; color: string; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => {
    if (!ref.current) return;
    const pulse = Math.sin(s.clock.elapsedTime * 2) * 0.02;
    ref.current.scale.setScalar(1 + pulse);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ─── Orbiting Moons ───
function Moons({ parentR, color, glow, count }: { parentR: number; color: string; glow: string; count: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const moonData = useMemo(() => {
    const n = Math.min(Math.max(count, 1), 3);
    return Array.from({ length: n }, (_, i) => ({
      orbit: parentR * (2.5 + i * 0.6),
      size: 0.03 + Math.random() * 0.03,
      speed: (0.8 + Math.random() * 0.6) * (i % 2 === 0 ? 1 : -1),
      phase: (Math.PI * 2 * i) / n,
      tiltX: (Math.random() - 0.5) * 1.2,
    }));
  }, [parentR, count]);

  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    moonData.forEach((m, i) => {
      const child = groupRef.current.children[i];
      if (!child) return;
      const a = t * m.speed + m.phase;
      child.position.set(
        Math.cos(a) * m.orbit,
        Math.sin(a) * m.orbit * Math.sin(m.tiltX),
        Math.sin(a) * m.orbit * Math.cos(m.tiltX),
      );
    });
  });

  return (
    <group ref={groupRef}>
      {moonData.map((m, i) => (
        <mesh key={i}>
          <sphereGeometry args={[m.size, 12, 12]} />
          <meshPhysicalMaterial color={color} emissive={glow} emissiveIntensity={0.6} metalness={0.3} roughness={0.4} clearcoat={0.8} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Planet Node ───
function PlanetNode({ node, maxCount, onSelect, isHovered, onHover }: {
  node: GNode; maxCount: number; onSelect: (id: string) => void;
  isHovered: boolean; onHover: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const scaleRef = useRef(1);
  const planet = PLANET_COLORS[node.ci % PLANET_COLORS.length];
  const wobbleAxis = useRef(new THREE.Vector3(Math.random() * 0.3 - 0.15, 1, Math.random() * 0.3 - 0.15).normalize());

  useFrame((s, delta) => {
    if (!meshRef.current) return;
    const target = isHovered ? 1.4 : 1;
    scaleRef.current += (target - scaleRef.current) * Math.min(delta * 5, 1);
    const pulse = Math.sin(s.clock.elapsedTime * 1.2 + node.ci) * 0.03;
    meshRef.current.scale.setScalar(scaleRef.current + pulse);
    meshRef.current.rotateOnAxis(wobbleAxis.current, delta * 0.4);
  });

  const numRings = node.count > maxCount * 0.5 ? 2 : 1;

  return (
    <group ref={groupRef} position={node.pos}>
      {/* Atmosphere */}
      <Atmosphere radius={node.radius * 1.4} color={planet.glow} opacity={0.08} />

      {/* Core sphere */}
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(node.id); }}
        onPointerOver={() => { onHover(node.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[node.radius, 32, 32]} />
        <meshPhysicalMaterial
          color={planet.core}
          emissive={planet.core}
          emissiveIntensity={isHovered ? 0.8 : 0.5}
          metalness={0.6}
          roughness={0.3}
          clearcoat={0.5}
        />
      </mesh>

      {/* Rings */}
      {Array.from({ length: numRings }, (_, i) => (
        <Ring
          key={i}
          radius={node.radius * (1.6 + i * 0.4)}
          color={planet.ring}
          opacity={0.35 - i * 0.1}
          tiltX={0.8 + i * 0.3}
          tiltZ={i * 0.4}
          speed={1.5 - i * 0.4}
        />
      ))}

      {/* Moons */}
      <Moons parentR={node.radius} color={planet.glow} glow={planet.core} count={Math.ceil(node.count / (maxCount * 0.3))} />

      {/* Label */}
      <Billboard position={[0, node.radius + 0.35, 0]}>
        <Text fontSize={0.22} color="white" anchorX="center" anchorY="bottom" outlineWidth={0.015} outlineColor="black" font={undefined}>
          {node.label}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Edge Lines ───
function EdgeLines({ edges, nodes }: { edges: GEdge[]; nodes: GNode[] }) {
  const nodeMap = useMemo(() => {
    const m: Record<string, GNode> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const lines = useMemo(() => {
    return edges.map((e, i) => {
      const s = nodeMap[e.source];
      const t = nodeMap[e.target];
      if (!s || !t) return null;
      const pts = [new THREE.Vector3(...s.pos), new THREE.Vector3(...t.pos)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color("hsl(220, 50%, 55%)"),
        transparent: true,
        opacity: Math.min(0.08 + e.weight * 0.04, 0.35),
      });
      return new THREE.Line(geo, mat);
    }).filter(Boolean);
  }, [edges, nodeMap]);

  return (
    <>
      {lines.map((l, i) => (
        <primitive key={i} object={l!} />
      ))}
    </>
  );
}

// ─── Central Black Hole ───
function BlackHole() {
  const ref = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.3;
    if (ringRef.current) {
      ringRef.current.rotation.z = s.clock.elapsedTime * 0.5;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(s.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#050510" />
      </mesh>
      {/* Accretion disk */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.2, 0.15, 8, 128]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={0.8}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Gravitational glow */}
      <mesh>
        <sphereGeometry args={[1.0, 24, 24]} />
        <meshBasicMaterial color="#2200aa" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Scene ───
function CosmosScene({ links, onNodeClick }: { links: Link[]; onNodeClick: (tag: string) => void }) {
  const { nodes, edges } = useMemo(() => buildGraph(links), [links]);
  const maxCount = Math.max(1, ...nodes.map(n => n.count));
  const [hovered, setHovered] = useState<string | null>(null);

  const groupRef = useRef<THREE.Group>(null!);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.02;
  });

  return (
    <>
      <color attach="background" args={["#05050f"]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 10]} intensity={0.6} color="#6688ff" />
      <pointLight position={[-8, -5, 6]} intensity={0.4} color="#aa44ff" />
      <pointLight position={[0, 8, -8]} intensity={0.3} color="#22ccaa" />
      <fog attach="fog" args={["#05050f", 25, 55]} />

      <Starfield />

      <group ref={groupRef}>
        <BlackHole />
        <EdgeLines edges={edges} nodes={nodes} />
        {nodes.map(node => (
          <PlanetNode
            key={node.id}
            node={node}
            maxCount={maxCount}
            onSelect={onNodeClick}
            isHovered={hovered === node.id}
            onHover={setHovered}
          />
        ))}
      </group>

      <OrbitControls
        enableZoom
        enablePan={false}
        minDistance={6}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// ─── Exported Component ───
export function DashboardCosmosGraph({ links }: { links: Link[] }) {
  const { nodes } = useMemo(() => buildGraph(links), [links]);
  const navigate = useNavigate();

  const handleNodeClick = useCallback((tag: string) => {
    navigate(`/knowledge?tag=${encodeURIComponent(tag)}`);
  }, [navigate]);

  if (nodes.length < 2) {
    return (
      <div className="h-72 rounded-xl border border-dashed border-muted-foreground/20 flex items-center justify-center bg-muted/5">
        <div className="text-center">
          <Network className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Add more tagged links to see your knowledge cosmos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-primary/10">
      {/* 3D Canvas */}
      <div className="h-[340px] w-full cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [0, 8, 18], fov: 50 }}>
          <CosmosScene links={links} onNodeClick={handleNodeClick} />
        </Canvas>
      </div>

      {/* Overlay: title + tags */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <Badge variant="outline" className="bg-background/60 backdrop-blur-sm text-[10px] font-mono pointer-events-auto">
          <Network className="h-3 w-3 mr-1" />
          {nodes.length} topics
        </Badge>
      </div>

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background via-background/80 to-transparent px-4 pb-3 pt-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Knowledge Cosmos</span>
          <Button variant="ghost" size="sm" asChild className="h-6 text-[10px] gap-1">
            <RouterLink to="/knowledge">
              Full graph <ArrowRight className="h-3 w-3" />
            </RouterLink>
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {nodes.slice(0, 10).map(node => {
            const c = PLANET_COLORS[node.ci % PLANET_COLORS.length];
            return (
              <Badge
                key={node.id}
                variant="outline"
                className="text-[9px] gap-1 cursor-pointer hover:bg-primary/10 transition-colors bg-background/50 backdrop-blur-sm"
                onClick={() => handleNodeClick(node.id)}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.core }} />
                {node.label}
              </Badge>
            );
          })}
          {nodes.length > 10 && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground bg-background/50">
              +{nodes.length - 10} more
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
