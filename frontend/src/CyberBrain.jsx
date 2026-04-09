import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Icosahedron, MeshTransmissionMaterial, Float } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

export default function CyberBrain({ isThinking }) {
  const outerRef = useRef();
  const innerRef = useRef();

  // Ultra-slow, calming ambient rotation
  useFrame((state, delta) => {
    if (outerRef.current) {
      outerRef.current.rotation.x += delta * (isThinking ? 0.3 : 0.05);
      outerRef.current.rotation.y += delta * (isThinking ? 0.4 : 0.1);
    }
    if (innerRef.current) {
      innerRef.current.rotation.x -= delta * (isThinking ? 0.5 : 0.1);
      innerRef.current.rotation.y -= delta * (isThinking ? 0.6 : 0.1);
    }
  });

  return (
    <>
      <Float speed={isThinking ? 2 : 1} rotationIntensity={0.5} floatIntensity={1}>
        <mesh ref={outerRef}>
          {/* Outer Glass Shell using highly realistic transmission */}
          <Sphere args={[1.2, 64, 64]}>
            <MeshTransmissionMaterial 
              backside
              backsideThickness={1}
              thickness={2.5}
              chromaticAberration={0.06}
              anisotropy={0.1}
              clearcoat={1}
              clearcoatRoughness={0.1}
              roughness={0}
              transmission={1}
              ior={1.4}
              color="#eaf4ff"
            />
          </Sphere>

          {/* Inner core - subtle geometry that gently refracts inside the glass */}
          <Icosahedron args={[0.55, 1]} ref={innerRef}>
            <meshPhysicalMaterial
              color="#001122"
              emissive={isThinking ? "#00c3ff" : "#1e3a5f"}
              emissiveIntensity={isThinking ? 1.5 : 0.4}
              wireframe={!isThinking}
              roughness={0.1}
              metalness={0.9}
            />
          </Icosahedron>
        </mesh>
      </Float>

      {/* Ambient bloom, much softer threshold so it only glows inside */}
      <EffectComposer disableNormalPass>
        <Bloom
          luminanceThreshold={0.5}
          mipmapBlur
          intensity={isThinking ? 1.0 : 0.3}
          radius={0.8}
        />
      </EffectComposer>
    </>
  );
}
