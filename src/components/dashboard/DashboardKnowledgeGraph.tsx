import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Text } from "@react-three/drei";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Network } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import * as THREE from "three";

interface Link {
  tags?: string[] | null;
  content_type?: string | null;
}

interface GraphNode {
  id: string;
  label: string;
  count: number;
  position: [number, number, number];
  colorIndex: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

const PALETTE = [
  "hsl(200, 80%, 55%)", "hsl(160, 70%, 50%)", "hsl(280, 65%, 55%)",
  "hsl(40, 85%, 50%)", "hsl(0, 70%, 55%)", "hsl(320, 60%, 55%)",
  "hsl(120, 60%, 45%)", "hsl(220, 75%, 60%)",
];

function buildMiniGraph(links: Link[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const tagCounts: Record<string, number> = {};
  links.forEach(l => (l.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (topTags.length === 0) return { nodes: [], edges: [] };

  const maxCount = topTags[0][1];
  const nodes: GraphNode[] = topTags.map(([tag, count], i) => {
    const angle = (i / topTags.length) * Math.PI * 2;
    const r = 2.2 + Math.sin(i * 1.7) * 0.5;
    const y = Math.cos(i * 0.8) * 0.8;
    return {
      id: tag,
      label: tag,
      count,
      position: [Math.cos(angle) * r, y, Math.sin(angle) * r] as [number, number, number],
      colorIndex: i,
    };
  });

  const coOccur: Record<string, number> = {};
  links.forEach(l => {
    const tags = (l.tags || []).filter(t => tagCounts[t]);
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join("|");
        coOccur[key] = (coOccur[key] || 0) + 1;
      }
    }
  });

  const edges: GraphEdge[] = Object.entries(coOccur)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, weight]) => {
      const [source, target] = key.split("|");
      return { source, target, weight };
    });

  return { nodes, edges };
}

function TagNode({ node, maxCount }: { node: GraphNode; maxCount: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const scale = 0.15 + (node.count / maxCount) * 0.25;
  const color = new THREE.Color(PALETTE[node.colorIndex % PALETTE.length]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const idx = node.colorIndex;
    meshRef.current.position.x = node.position[0] + Math.sin(t * 0.5 + idx) * 0.1;
    meshRef.current.position.y = node.position[1] + Math.sin(t * 0.7 + idx * 1.3) * 0.15;
    meshRef.current.position.z = node.position[2] + Math.cos(t * 0.4 + idx) * 0.1;
  });

  return (
    <group>
      <mesh ref={meshRef} position={node.position}>
        <sphereGeometry args={[scale, 24, 24]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.7}
          distort={0.2}
          speed={1.5}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

function EdgeLine({ edge, nodes }: { edge: GraphEdge; nodes: GraphNode[] }) {
  const src = nodes.find(n => n.id === edge.source);
  const tgt = nodes.find(n => n.id === edge.target);

  const lineObj = useMemo(() => {
    if (!src || !tgt) return null;
    const points = [new THREE.Vector3(...src.position), new THREE.Vector3(...tgt.position)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color("hsl(220, 60%, 50%)"),
      transparent: true,
      opacity: Math.min(0.15 + edge.weight * 0.05, 0.5),
    });
    return new THREE.Line(geometry, material);
  }, [src, tgt, edge.weight]);

  if (!lineObj) return null;

  return <primitive object={lineObj} />;
}

function GraphCore() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[0.35, 1]} />
        <meshStandardMaterial
          color="hsl(220, 70%, 55%)"
          emissive="hsl(220, 70%, 35%)"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
    </Float>
  );
}

function FloatingParticles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="hsl(220, 70%, 65%)"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

function GraphScene({ links }: { links: Link[] }) {
  const { nodes, edges } = useMemo(() => buildMiniGraph(links), [links]);
  const maxCount = Math.max(1, ...nodes.map(n => n.count));

  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color="hsl(220, 80%, 70%)" />
      <pointLight position={[-4, -3, 3]} intensity={0.4} color="hsl(280, 60%, 60%)" />
      <pointLight position={[0, -5, -5]} intensity={0.3} color="hsl(160, 60%, 50%)" />

      <FloatingParticles count={80} />

      <group ref={groupRef}>
        <GraphCore />
        {edges.map((edge, i) => (
          <EdgeLine key={i} edge={edge} nodes={nodes} />
        ))}
        {nodes.map(node => (
          <TagNode key={node.id} node={node} maxCount={maxCount} />
        ))}
      </group>
    </>
  );
}

export function DashboardKnowledgeGraph({ links }: { links: Link[] }) {
  const { nodes } = useMemo(() => buildMiniGraph(links), [links]);

  if (nodes.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Network className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Add more tagged links to see your knowledge graph
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          Knowledge Graph
          <Badge variant="secondary" className="text-[10px] font-mono ml-1">
            {nodes.length} topics
          </Badge>
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <RouterLink to="/knowledge" className="text-xs gap-1">
            Full graph <ArrowRight className="h-3 w-3" />
          </RouterLink>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-64 w-full">
          <Canvas camera={{ position: [0, 2, 5], fov: 45 }}>
            <GraphScene links={links} />
          </Canvas>
        </div>
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {nodes.slice(0, 8).map(node => (
            <Badge key={node.id} variant="outline" className="text-[9px] gap-1">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: PALETTE[node.colorIndex % PALETTE.length] }}
              />
              {node.label}
            </Badge>
          ))}
          {nodes.length > 8 && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">
              +{nodes.length - 8} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
