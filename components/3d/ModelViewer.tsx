"use client";

import { Html, OrbitControls, Center, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Box, Loader2 } from "lucide-react";
import { Suspense, useMemo } from "react";

interface ModelViewerProps {
  modelUrl: string | null;
  className?: string;
}

function Mesh({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} />;
}

function CanvasLoader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 rounded-lg bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 border border-slate-800">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
        Loading mesh...
      </div>
    </Html>
  );
}

function Scene({ url }: { url: string }) {
  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.15} color="#f8fafc" />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c4b5fd" />
      <hemisphereLight args={["#e2e8f0", "#1e1b4b", 0.35]} />
      <Suspense fallback={<CanvasLoader />}>
        <Center>
          <Mesh url={url} />
        </Center>
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={0.6}
        maxDistance={8}
      />
    </>
  );
}

export function ModelViewer({ modelUrl, className = "" }: ModelViewerProps) {
  if (!modelUrl) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 text-center ${className}`}
      >
        <Box className="w-8 h-8 text-slate-600" />
        <p className="text-sm text-slate-400">3D preview</p>
        <p className="text-[11px] text-slate-500 max-w-[16rem]">
          Выберите фото товара и нажмите Generate 3D — здесь появится интерактивная модель.
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 ${className}`}>
      <Canvas
        camera={{ position: [1.4, 1.1, 1.8], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene key={modelUrl} url={modelUrl} />
      </Canvas>
    </div>
  );
}
