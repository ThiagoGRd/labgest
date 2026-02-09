'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'
import { Loader2, AlertCircle } from 'lucide-react'

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url)
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#6366f1" roughness={0.5} />
    </mesh>
  )
}

export function STLViewer({ url, className }: { url: string; className?: string }) {
  const [error, setError] = useState(false)

  // Reset error state when url changes
  useEffect(() => {
    setError(false)
  }, [url])

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg ${className}`}>
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Erro ao carregar visualização 3D</p>
      </div>
    )
  }

  return (
    <div className={`relative bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden ${className}`}>
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }>
        <ErrorBoundary setHasError={setError}>
          <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 150], fov: 50 }}>
            <Stage environment="city" intensity={0.5}>
              <Model url={url} />
            </Stage>
            <OrbitControls makeDefault autoRotate autoRotateSpeed={1} />
          </Canvas>
        </ErrorBoundary>
      </Suspense>
    </div>
  )
}

class ErrorBoundary extends React.Component<{ setHasError: (v: boolean) => void, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("STLViewer Error:", error, errorInfo)
    this.props.setHasError(true)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}
