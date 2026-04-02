import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshWobbleMaterial, Text } from "@react-three/drei";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import * as THREE from "three";

interface PendingLink {
  id: string;
  title: string | null;
  original_url: string;
  domain: string | null;
  created_at: string;
  status: string;
}

interface PendingAnalysisWidgetProps {
  pendingLinks: PendingLink[];
  isLoading: boolean;
  onRetry?: (id: string) => void;
}

function AnalysisOrb({ index, total, status }: { index: number; total: number; status: string }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const radius = 1.6;
  const baseX = Math.cos(angle) * radius;
  const baseZ = Math.sin(angle) * radius;

  const color = status === "failed"
    ? new THREE.Color("hsl(0, 70%, 55%)")
    : new THREE.Color(`hsl(${200 + index * 30}, 70%, 60%)`);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.x = baseX + Math.sin(t * 0.8 + index) * 0.15;
    meshRef.current.position.y = Math.sin(t * 1.2 + index * 0.7) * 0.3;
    meshRef.current.position.z = baseZ + Math.cos(t * 0.6 + index) * 0.15;
    meshRef.current.scale.setScalar(0.28 + Math.sin(t * 2 + index) * 0.04);
  });

  return (
    <mesh ref={meshRef} position={[baseX, 0, baseZ]}>
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        roughness={0.2}
        metalness={0.8}
        distort={status === "failed" ? 0.5 : 0.3}
        speed={status === "failed" ? 3 : 2}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function CentralCore() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.3;
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    meshRef.current.scale.setScalar(0.55 + Math.sin(t * 1.5) * 0.05);
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 2]} />
        <MeshWobbleMaterial
          color="hsl(220, 70%, 55%)"
          emissive="hsl(220, 70%, 35%)"
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.9}
          factor={0.3}
          speed={1.5}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function OrbitalRing({ radius, speed, opacity }: { radius: number; speed: number; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = state.clock.elapsedTime * speed;
    ref.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.008, 16, 100]} />
      <meshStandardMaterial
        color="hsl(220, 60%, 60%)"
        emissive="hsl(220, 60%, 40%)"
        emissiveIntensity={0.5}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function Scene({ count, links }: { count: number; links: PendingLink[] }) {
  const displayLinks = links.slice(0, 8);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} color="hsl(220, 80%, 70%)" />
      <pointLight position={[-5, -3, 3]} intensity={0.5} color="hsl(270, 70%, 60%)" />

      <CentralCore />

      <OrbitalRing radius={1.2} speed={0.2} opacity={0.3} />
      <OrbitalRing radius={2.0} speed={-0.15} opacity={0.2} />

      {displayLinks.map((link, i) => (
        <AnalysisOrb key={link.id} index={i} total={displayLinks.length} status={link.status} />
      ))}
    </>
  );
}

export function PendingAnalysisWidget({ pendingLinks, isLoading, onRetry }: PendingAnalysisWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  const displayLinks = expanded ? pendingLinks : pendingLinks.slice(0, 3);

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6 h-48 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pendingLinks.length === 0) return null;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-fade-in">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="relative">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <div className="absolute inset-0 h-4 w-4 bg-primary/20 rounded-full animate-ping" />
          </div>
          Analyzing Links
          <Badge variant="secondary" className="text-[10px] font-mono ml-1">
            {pendingLinks.length}
          </Badge>
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <RouterLink to="/library" className="text-xs gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </RouterLink>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {/* 3D Scene */}
        <div className="h-44 w-full relative">
          <Canvas camera={{ position: [0, 2, 4], fov: 50 }}>
            <Scene count={pendingLinks.length} links={pendingLinks} />
          </Canvas>
          {/* Overlay count */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-3xl font-bold font-mono text-primary drop-shadow-lg">
                {pendingLinks.length}
              </span>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {pendingLinks.some(l => l.status === "failed") ? "need attention" : "processing"}
              </p>
            </div>
          </div>
        </div>

        {/* Link list */}
        <div className="px-4 pb-4 space-y-1 mt-1">
          {displayLinks.map((link, i) => (
            <div
              key={link.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-all group"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`h-2 w-2 rounded-full shrink-0 ${
                link.status === "failed" ? "bg-destructive" : "bg-primary animate-pulse"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {link.title || link.domain || link.original_url}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                </span>
              </div>
              {link.status === "failed" && onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRetry(link.id)}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Badge
                variant={link.status === "failed" ? "destructive" : "secondary"}
                className="text-[9px] shrink-0"
              >
                {link.status === "failed" ? "Failed" : "Analyzing"}
              </Badge>
            </div>
          ))}

          {pendingLinks.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground mt-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : `Show ${pendingLinks.length - 3} more`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
