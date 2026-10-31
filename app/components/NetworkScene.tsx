"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Stars, Line } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

const nodes = [
  { id: "CORE", position: [0, 0, 0] as [number, number, number], color: "#70e7f2", size: 0.22 },
  { id: "ROUTER", position: [1.8, 0.8, 0.2] as [number, number, number], color: "#70e7f2", size: 0.15 },
  { id: "SWITCH", position: [-1.8, 0.7, -0.2] as [number, number, number], color: "#70e7f2", size: 0.15 },
  { id: "HOSTEL", position: [1.5, -1.1, -0.4] as [number, number, number], color: "#a78bfa", size: 0.13 },
  { id: "CAMPUS", position: [-1.5, -1.1, 0.4] as [number, number, number], color: "#a78bfa", size: 0.13 },
  { id: "GATEWAY", position: [0, 1.8, -0.5] as [number, number, number], color: "#70e7f2", size: 0.14 },
  { id: "SERVER", position: [0, -1.9, 0.3] as [number, number, number], color: "#a78bfa", size: 0.14 },
];

const connections = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 5], [2, 5], [3, 6], [4, 6],
];

function NetworkNode({ position, color, size }: {
  position: [number, number, number];
  color: string;
  size: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.2 + position[0]) * 0.08;
      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 2.5, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.09} />
      </mesh>
    </group>
  );
}

function NetworkStructure() {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.055;
  });

  return (
    <group ref={group}>
      {connections.map(([from, to], index) => (
        <Line
          key={index}
          points={[nodes[from].position, nodes[to].position]}
          color="#54cbdc"
          transparent
          opacity={0.34}
          lineWidth={1}
        />
      ))}

      {nodes.map((node) => (
        <Float key={node.id} speed={1.2} floatIntensity={0.16} rotationIntensity={0.1}>
          <NetworkNode
            position={node.position}
            color={node.color}
            size={node.size}
          />
        </Float>
      ))}

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.003, 8, 120]} />
        <meshBasicMaterial color="#5b9cae" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

export default function NetworkScene() {
  return (
    <div className="network-scene relative h-full w-full overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 42 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.65} />
        <pointLight position={[4, 4, 5]} intensity={2.2} color="#70e7f2" />
        <pointLight position={[-4, -3, -2]} intensity={1.5} color="#8b5cf6" />

        <Stars radius={55} depth={35} count={900} factor={2} saturation={0} fade speed={0.35} />

        <NetworkStructure />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={5}
          maxDistance={11}
          autoRotate={false}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>
    </div>
  );
}
