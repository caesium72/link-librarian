import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Filter, RotateCcw } from "lucide-react";
import type { Link } from "@/types/links";

interface Node3D {
  id: string;
  label: string;
  count: number;
  position: [number, number, number];
  radius: number;
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

  const nodes: Node3D[] = topTags.map((tag, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / topTags.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const spread = 5;
    const r = 0.2 + (tagCount[tag] / maxC) * 0.45;
    return {
      id: tag,
      label: tag,
      count: tagCount[tag],
      position: [
        spread * Math.sin(phi) * Math.cos(theta),
        spread * Math.sin(phi) * Math.sin(theta),
        spread * Math.cos(phi),
      ] as [number, number, number],
      radius: r,
    };
  });

  const edges: Edge3D[] = [];
  for (const [key, weight] of Object.entries(cooccurrence)) {
    const [a, b] = key.split("|||");
    if (topSet.has(a) && topSet.has(b)) {
      edges.push({ source: a, target: b, weight });
    }
  }

  return { nodes, edges, tagLinks };
}

// ─── Animated ring orbiting a node ───
function OrbitRing({ radius, speed, color, opacity }: { radius: number; speed: number; color: string; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * speed * 0.5;
    ref.current.rotation.y = state.clock.elapsedTime * speed;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.008, 8, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

// ─── 3D Node Sphere ───
function NodeSphere({
  node,
  isSelected,
  isConnected,
  isHovered,
  maxCount,
  onSelect,
  onHover,
}: {
  node: Node3D;
  isSelected: boolean;
  isConnected: boolean;
  isHovered: boolean;
  maxCount: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const outerGlowRef = useRef<THREE.Mesh>(null!);
  const innerGlowRef = useRef<THREE.Mesh>(null!);
  const currentScale = useRef(1);
  const pulsePhase = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const target = isSelected ? 1.5 : isHovered ? 1.3 : isConnected ? 1.15 : 1;
    currentScale.current += (target - currentScale.current) * Math.min(delta * 6, 1);

    // Breathing pulse
    const pulse = Math.sin(state.clock.elapsedTime * 1.5 + pulsePhase.current) * 0.04;
    meshRef.current.scale.setScalar(currentScale.current + pulse);

    // Slow self-rotation for 3D feel
    meshRef.current.rotation.y += delta * 0.3;

    if (outerGlowRef.current) {
      outerGlowRef.current.scale.setScalar((currentScale.current + pulse) * 2.2);
      const mat = outerGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = isSelected ? 0.12 : isHovered ? 0.08 : isConnected ? 0.04 : 0.02;
    }
    if (innerGlowRef.current) {
      innerGlowRef.current.scale.setScalar((currentScale.current + pulse) * 1.4);
      const mat = innerGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = isSelected ? 0.25 : isHovered ? 0.18 : isConnected ? 0.1 : 0.05;
    }
  });

  const baseHue = (node.count / maxCount) * 60; // shift from purple to blue-purple
  const color = isSelected
    ? "#c084fc"
    : isConnected
    ? "#a78bfa"
    : isHovered
    ? "#d8b4fe"
    : "#8b5cf6";

  const emissiveColor = isSelected ? "#e9d5ff" : isHovered ? "#c084fc" : "#7c3aed";
  const emissiveIntensity = isSelected ? 1.2 : isHovered ? 0.8 : isConnected ? 0.4 : 0.15;

  const showRings = isSelected || isHovered;

  return (
    <group position={node.position}>
      {/* Outer glow */}
      <mesh ref={outerGlowRef}>
        <sphereGeometry args={[node.radius, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.02} depthWrite={false} />
      </mesh>

      {/* Inner glow */}
      <mesh ref={innerGlowRef}>
        <sphereGeometry args={[node.radius, 16, 16]} />
        <meshBasicMaterial color={emissiveColor} transparent opacity={0.05} depthWrite={false} />
      </mesh>

      {/* Main sphere - glass-like material */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(isSelected ? null : node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[node.radius, 64, 64]} />
        <meshPhysicalMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          metalness={0.1}
          roughness={0.15}
          transmission={0.3}
          thickness={1.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={1.5}
          transparent
          opacity={isSelected || isConnected || isHovered ? 0.95 : 0.8}
        />
      </mesh>

      {/* Orbit rings on interaction */}
      {showRings && (
        <>
          <OrbitRing radius={node.radius * 1.6} speed={1.2} color="#c084fc" opacity={0.4} />
          <OrbitRing radius={node.radius * 2.0} speed={-0.8} color="#a78bfa" opacity={0.25} />
        </>
      )}

      {/* Label */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, node.radius + 0.3, 0]}
          fontSize={0.2}
          color={isSelected || isHovered ? "#f3e8ff" : "#a1a1aa"}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {node.label}
        </Text>
        <Text
          position={[0, 0, 0]}
          fontSize={0.14}
          color="#f3e8ff"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {String(node.count)}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Animated 3D Edge ───
function EdgeLine({
  from,
  to,
  weight,
  maxWeight,
  isHighlighted,
  isDimmed,
}: {
  from: [number, number, number];
  to: [number, number, number];
  weight: number;
  maxWeight: number;
  isHighlighted: boolean;
  isDimmed: boolean;
}) {
  const ref = useRef<THREE.Line>(null!);
  const targetOpacity = useRef(0.2);

  const geometry = useMemo(() => {
    // Curved edge using quadratic bezier
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    // Push midpoint outward for curve
    const offset = mid.clone().normalize().multiplyScalar(0.5);
    mid.add(offset);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(32);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [from, to]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = isDimmed ? 0.03 : isHighlighted ? 0.6 : 0.15;
    targetOpacity.current += (target - targetOpacity.current) * Math.min(delta * 5, 1);
    const mat = ref.current.material as THREE.LineBasicMaterial;
    mat.opacity = targetOpacity.current;
  });

  const color = isHighlighted ? "#c084fc" : "#4a4a5a";

  return (
    <line ref={ref} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.15} />
    </line>
  );
}

// ─── Floating particles background ───
function Particles() {
  const count = 300;
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 25;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 25;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    return arr;
  }, []);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = Math.random() * 0.04 + 0.01;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.015;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.008) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#7c3aed"
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
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
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  return (
    <>
      {/* Lighting for 3D depth */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#a855f7" />
      <pointLight position={[-10, -10, -5]} intensity={0.8} color="#6366f1" />
      <pointLight position={[0, 8, -10]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[5, -5, 8]} intensity={0.3} color="#c084fc" />
      <directionalLight position={[0, 5, 5]} intensity={0.4} />

      <Particles />

      {/* Edges */}
      {edges.map((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        const isHighlighted =
          selectedTag === edge.source ||
          selectedTag === edge.target ||
          hoveredTag === edge.source ||
          hoveredTag === edge.target;
        const isDimmed = (selectedTag || hoveredTag) && !isHighlighted;
        return (
          <EdgeLine
            key={`${edge.source}-${edge.target}`}
            from={s.position}
            to={t.position}
            weight={edge.weight}
            maxWeight={maxWeight}
            isHighlighted={isHighlighted}
            isDimmed={!!isDimmed}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isSelected = selectedTag === node.id;
        const isConnected = connectedTags.has(node.id);
        const isHovered = hoveredTag === node.id;
        return (
          <Float
            key={node.id}
            speed={isSelected ? 3 : 1.5}
            rotationIntensity={isSelected ? 0.2 : 0.05}
            floatIntensity={isSelected ? 0.4 : 0.15}
            floatingRange={[-0.08, 0.08]}
          >
            <NodeSphere
              node={node}
              isSelected={isSelected}
              isConnected={isConnected}
              isHovered={isHovered}
              maxCount={maxCount}
              onSelect={onSelect}
              onHover={onHover}
            />
          </Float>
        );
      })}

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={3}
        maxDistance={15}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
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
              <fog attach="fog" args={["#09090b", 14, 25]} />
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

          {/* Controls hint */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border/40 animate-in fade-in duration-500">
            <RotateCcw className="h-3 w-3" />
            Drag to orbit · Scroll to zoom · Click nodes
          </div>

          {/* Hovered tag tooltip */}
          {hoveredTag && !selectedTag && (
            <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/60 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-xs font-semibold">{hoveredTag}</p>
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
                  {Array.from(connectedTags).map((tag, i) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:scale-105 transition-all duration-200 animate-in fade-in zoom-in-90"
                      style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                      onClick={() => setSelectedTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
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
