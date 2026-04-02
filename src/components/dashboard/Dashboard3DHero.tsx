import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshWobbleMaterial } from "@react-three/drei";
import * as THREE from "three";

function DNAHelix() {
  const groupRef = useRef<THREE.Group>(null!);
  const count = 20;

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
  });

  const spheres = useMemo(() => {
    const items: { pos: [number, number, number]; color: string; strand: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 3;
      const y = (i / count) * 4 - 2;
      items.push({
        pos: [Math.cos(t) * 0.8, y, Math.sin(t) * 0.8],
        color: `hsl(${200 + i * 8}, 70%, 55%)`,
        strand: 0,
      });
      items.push({
        pos: [Math.cos(t + Math.PI) * 0.8, y, Math.sin(t + Math.PI) * 0.8],
        color: `hsl(${280 + i * 5}, 60%, 55%)`,
        strand: 1,
      });
    }
    return items;
  }, []);

  return (
    <group ref={groupRef} position={[-2.5, 0, 0]}>
      {spheres.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color={s.color}
            emissive={s.color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

function PulsingRings() {
  const refs = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.forEach((ref, i) => {
      if (!ref.current) return;
      const scale = 1 + Math.sin(t * 1.5 + i * 1.2) * 0.15;
      ref.current.scale.setScalar(scale);
      ref.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.15;
      ref.current.rotation.z = t * (0.1 + i * 0.05);
    });
  });

  return (
    <group position={[2.5, 0, 0]}>
      {[0.8, 1.1, 1.4].map((r, i) => (
        <mesh key={i} ref={refs[i]}>
          <torusGeometry args={[r, 0.015, 16, 64]} />
          <meshStandardMaterial
            color={`hsl(${160 + i * 40}, 70%, 55%)`}
            emissive={`hsl(${160 + i * 40}, 70%, 35%)`}
            emissiveIntensity={0.6}
            transparent
            opacity={0.5 - i * 0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

function CentralGem() {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.4;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.5, 0]} />
        <MeshDistortMaterial
          color="hsl(220, 80%, 60%)"
          emissive="hsl(220, 80%, 35%)"
          emissiveIntensity={0.7}
          roughness={0.1}
          metalness={0.9}
          distort={0.15}
          speed={2}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  );
}

function OrbitingMoons() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.6;
  });

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2;
        const r = 1.2;
        return (
          <mesh key={i} position={[Math.cos(angle) * r, Math.sin(i) * 0.3, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <MeshWobbleMaterial
              color={`hsl(${40 + i * 60}, 75%, 55%)`}
              emissive={`hsl(${40 + i * 60}, 75%, 35%)`}
              emissiveIntensity={0.5}
              factor={0.5}
              speed={2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function AmbientParticles() {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.015;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={120} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="hsl(220, 60%, 70%)" transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

function HeroScene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 4]} intensity={0.7} color="hsl(220, 80%, 70%)" />
      <pointLight position={[-4, -2, 3]} intensity={0.4} color="hsl(280, 60%, 60%)" />
      <pointLight position={[0, 3, -4]} intensity={0.3} color="hsl(160, 60%, 55%)" />

      <AmbientParticles />
      <CentralGem />
      <OrbitingMoons />
      <DNAHelix />
      <PulsingRings />
    </>
  );
}

export function Dashboard3DHero() {
  return (
    <div className="h-32 w-full rounded-xl overflow-hidden relative bg-gradient-to-r from-primary/5 via-background to-accent/5 border border-primary/10">
      <Canvas camera={{ position: [0, 1.5, 5], fov: 50 }}>
        <HeroScene />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
