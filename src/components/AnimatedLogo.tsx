"use client"

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

// Versión simplificada sin efectos extra para iterar sin parpadeos
interface AnimatedLogoProps {
  frames: string[]
  fallback: string
  interval?: number   // ms entre frames
  size?: number
  playing?: boolean
  loop?: boolean      // loop simple (0->n-1->0->...)
  mode?: 'loop' | 'bounce' // bounce: ida y vuelta 0..n-1..0
  fade?: boolean      // crossfade (se desactiva si bounce y se busca continuidad)
  className?: string
  imageClassName?: string
  circle?: boolean
  preloadAll?: boolean // espera precarga para iniciar
  startDelay?: number  // ms tras carga completa antes de animar
  waves?: boolean      // mostrar ondas radar
  waveCount?: number   // cantidad de ondas simultáneas
  waveColor?: string   // color/borde de onda
  waveDuration?: number // ms por ciclo de cada onda
  endpointPause?: number // ms de pausa en extremos (bounce)
}

export function AnimatedLogo({
  frames,
  fallback,
  interval = 140,
  size = 80,
  playing = true,
  loop = true,
  mode = 'loop',
  fade = true,
  className = '',
  imageClassName = '',
  circle = false,
  preloadAll = true,
  startDelay = 40,
  waves = true,
  waveCount = 3,
  waveColor = 'rgba(164,137,221,0.4)',
  waveDuration = 2400,
  endpointPause = 120,
}: AnimatedLogoProps) {
  const framesToUse = frames.length ? frames : [fallback]
  const length = framesToUse.length
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const directionRef = useRef(1) // para bounce
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [loaded, setLoaded] = useState(false)      // preload mínimo (todas si preloadAll)
  const [started, setStarted] = useState(false)    // animación arrancó
  const endpointHoldRef = useRef<number>(0)
  const loadedCountRef = useRef(0)

  // Preload frames (todas) para evitar parpadeo; solo arranca cuando todas cargaron o fallaron
  useEffect(() => {
    if (!preloadAll) { setLoaded(true); return }
    let cancelled = false
    loadedCountRef.current = 0
    framesToUse.forEach(src => {
      const img = typeof window !== 'undefined' ? new window.Image() : ({} as any)
      img.decoding = 'async'
      img.onload = () => {
        loadedCountRef.current += 1
        if (!cancelled && loadedCountRef.current >= length) setLoaded(true)
      }
      img.onerror = () => {
        loadedCountRef.current += 1
        if (!cancelled && loadedCountRef.current >= length) setLoaded(true)
      }
      img.src = src
    })
    return () => { cancelled = true }
  }, [framesToUse.join('|'), preloadAll, length])

  // Arranque diferido tras la carga completa para permitir pintura estable del primer frame
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setStarted(true), startDelay)
    return () => clearTimeout(t)
  }, [loaded, startDelay])

  // Preload para evitar flash
  useEffect(() => {
    if (typeof window === 'undefined') return
    framesToUse.forEach(src => { const i = new window.Image(); i.src = src })
  }, [length])

  useEffect(() => {
    if (!started || !playing || length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current)
      setIndex(0)
      setPrev(null)
      return
    }
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex(prevIdx => {
        let nextIdx = prevIdx
        if (mode === 'bounce') {
          let dir = directionRef.current
          // si estamos en extremo aplicamos pausa controlada
          if ((prevIdx === 0 || prevIdx === length - 1) && endpointPause > 0) {
            endpointHoldRef.current += interval
            if (endpointHoldRef.current < endpointPause) return prevIdx
            endpointHoldRef.current = 0
          }
          nextIdx = prevIdx + dir
          if (nextIdx >= length - 1) { nextIdx = length - 1; directionRef.current = -1 }
          else if (nextIdx <= 0) { nextIdx = 0; directionRef.current = 1 }
        } else { // loop
          const raw = prevIdx + 1
          nextIdx = loop ? (raw % length) : Math.min(raw, length - 1)
        }
        if (nextIdx !== prevIdx) setPrev(prevIdx)
        return nextIdx
      })
    }, interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [started, playing, interval, length, loop, mode])

  const enableFade = fade // permitir fade también en bounce si el usuario lo desea

  return (
    <div className={`relative inline-flex items-center justify-center ${circle ? 'rounded-full' : ''} ${className}`}
         style={{ width: size, height: size }}>
      {waves && started && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          {Array.from({ length: waveCount }).map((_, i) => (
            <span
              key={i}
              className="absolute inset-0 rounded-full border animate-[wavePulse_var(--dur)_ease-out_infinite]"
              style={{
                borderColor: waveColor,
                borderWidth: 2,
                opacity: 0,
                animationDelay: `${(waveDuration / waveCount) * i}ms`,
                ['--dur' as any]: `${waveDuration}ms`
              }}
            />
          ))}
        </div>
      )}
  {enableFade && prev !== null && prev !== index && started && (
        <Image
          key={'prev-'+prev+'-'+index}
          src={framesToUse[prev] || fallback}
          alt="prev"
          width={size}
          height={size}
          priority
          className={`absolute inset-0 object-contain select-none pointer-events-none transition-opacity duration-150 ${imageClassName}`}
          style={{ opacity:0 }}
        />
      )}
      <Image
        key={'curr-'+index+(started?'':'-loading')}
        src={started ? (framesToUse[index] || fallback) : framesToUse[0] || fallback}
        alt="logo"
        width={size}
        height={size}
        priority
        className={`absolute inset-0 object-contain select-none pointer-events-none ${enableFade && prev !== null && started ? 'opacity-0 animate-fadeIn' : 'opacity-100'} ${imageClassName}`}
        style={!started ? {transition:'none'}:undefined}
      />
      {enableFade && (
        <style jsx>{`
          .animate-fadeIn { animation: fadeIn 180ms ease forwards; }
          @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
          @keyframes wavePulse { 0% { transform: scale(.5); opacity:.35 } 70% { opacity:0 } 100% { transform: scale(1.8); opacity:0 } }
        `}</style>
      )}
      {!enableFade && waves && (
        <style jsx>{`
          @keyframes wavePulse { 0% { transform: scale(.55); opacity:.4 } 65% { opacity:0.02 } 100% { transform: scale(1.9); opacity:0 } }
        `}</style>
      )}
    </div>
  )
}

export default AnimatedLogo
