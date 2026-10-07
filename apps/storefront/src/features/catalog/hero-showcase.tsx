"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useHeroMotion } from "./use-hero-motion";

const scenes = [
  { src: "/images/hero-rgb-keyboard-v2.png", label: "Teclado RGB", alt: "Teclado mecánico RGB iluminado en un escritorio oscuro y elegante" },
  { src: "/images/hero-nvidia-gpu-v2.png", label: "Gráfica NVIDIA", alt: "Tarjeta gráfica de estilo NVIDIA con iluminación azul y violeta en un estudio oscuro" },
  { src: "/images/hero-premium-headphones-v1.png", label: "Audio premium", alt: "Audífonos inalámbricos premium sobre un soporte en un escritorio oscuro con iluminación azul y violeta" },
] as const;

export function HeroShowcase({ interacting = false }: Readonly<{ interacting?: boolean }>) {
  const [settled, setSettled] = useState(false);
  const [loadNext, setLoadNext] = useState(false);
  const [loaded, setLoaded] = useState<readonly number[]>([]);
  const [failed, setFailed] = useState<readonly number[]>([]);
  // Pan as soon as the priority photo is available; secondary lazy loading
  // must not hold the visible photo still. Alternate when all scenes are ready.
  const motion = useHeroMotion(loaded.length === scenes.length ? scenes.length : 1, loaded.length > 0, interacting);
  // Defer the secondary asset until the priority image settles; cleanup on exit.
  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => setLoadNext(true), 2000);
    return () => window.clearTimeout(timer);
  }, [settled]);
  function select(index: number) { if (index > 0) setLoadNext(true); motion.select(index); }
  return (
    <div data-slot="hero-showcase" data-running={motion.running} data-active={motion.index}
      data-reduced-motion={motion.reduced} data-paused={motion.paused}
      onFocusCapture={() => motion.setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) motion.setFocused(false); }}>
      <div className="hero-frame" role="group" aria-label="Fotografías de hardware, selección de imagen">
        <div className="hero-fallback" aria-hidden="true">Technology Store · Hardware</div>
        {scenes.map((scene, index) => index === 0 || loadNext ? (
          <div key={scene.src} data-slot="hero-scene" data-active={motion.index === index}
            data-loaded={loaded.includes(index)} aria-hidden={motion.index !== index || failed.includes(index)} className="hero-scene">
            {!failed.includes(index) ? <Image alt={scene.alt} src={scene.src} fill sizes="(min-width: 1536px) 1440px, 100vw"
              loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "low"} className="hero-photo"
              onLoad={() => { setLoaded((current) => current.includes(index) ? current : [...current, index]); if (index === 0) setSettled(true); }}
              onError={() => { setFailed((current) => current.includes(index) ? current : [...current, index]); if (index === 0) setSettled(true); }} /> : null}
          </div>
        ) : null)}
      </div>
      <div className="hero-controls">
        <p className="m-0 text-sm text-[var(--ds-text-muted)]">Hardware en primer plano <span className="sr-only">· Imagen {motion.index + 1} de {scenes.length}</span></p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Controles de fotografías">
          {scenes.map((scene, index) => <button key={scene.src} type="button" aria-label={`Mostrar ${scene.label}`}
            aria-pressed={motion.index === index} className="hero-control" onClick={() => select(index)}>
            <span aria-hidden="true" className="hero-dot" />{scene.label}
          </button>)}
          <button type="button" className="hero-control" disabled={motion.reduced} aria-pressed={motion.paused}
            aria-label={motion.reduced ? "Movimiento reducido: imágenes estáticas" : motion.paused ? "Reanudar movimiento del hero" : "Pausar movimiento del hero"} onClick={motion.toggle}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              {motion.paused ? <path d="m5 3 8 5-8 5Z" /> : <path d="M4 3h3v10H4zm5 0h3v10H9z" />}
            </svg>{motion.reduced ? "Estático" : motion.paused ? "Reanudar" : "Pausar"}
          </button>
        </div>
      </div>
    </div>
  );
}
