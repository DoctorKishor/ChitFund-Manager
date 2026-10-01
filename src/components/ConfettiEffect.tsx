'use client';

import React, { useEffect, useRef } from 'react';

interface ConfettiEffectProps {
  durationMs?: number;
  particleCount?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  decay: number;
  shape: 'rect' | 'circle' | 'strip';
}

const FESTIVE_COLORS = [
  '#f59e0b', // Amber / Gold
  '#fbbf24', // Yellow gold
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#ffffff', // White sparkle
];

export default function ConfettiEffect({
  durationMs = 6000,
  particleCount = 120,
}: ConfettiEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isActive = true;

    // Set canvas dimensions
    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Generate initial particle bursts
    const particles: Particle[] = [];
    const shapes: ('rect' | 'circle' | 'strip')[] = ['rect', 'circle', 'strip'];

    for (let i = 0; i < particleCount; i++) {
      // Spawn from left and right corners and center top
      const originX = i % 3 === 0 
        ? canvas.width * 0.15 
        : i % 3 === 1 
          ? canvas.width * 0.85 
          : canvas.width * 0.5;
      
      const originY = i % 3 === 2 ? canvas.height * 0.1 : canvas.height * 0.3;

      const angle = (i % 3 === 0)
        ? (Math.random() * 0.5 - 0.25) * Math.PI - 0.2
        : (i % 3 === 1)
          ? (Math.random() * 0.5 + 0.75) * Math.PI + 0.2
          : (Math.random() * 1.5 + 0.25) * Math.PI;

      const speed = Math.random() * 14 + 6;

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * (i % 3 === 1 ? -1 : 1),
        vy: -Math.abs(Math.sin(angle) * speed) - (Math.random() * 4 + 2),
        angle: Math.random() * 360,
        angularVelocity: (Math.random() - 0.5) * 12,
        width: Math.random() * 10 + 6,
        height: Math.random() * 6 + 4,
        color: FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)],
        alpha: 1,
        decay: Math.random() * 0.003 + 0.002,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    const startTime = Date.now();

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsed = Date.now() - startTime;
      const isEnding = elapsed > durationMs;

      let livingParticles = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0) continue;

        livingParticles++;

        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // Gravity
        p.vx *= 0.99; // Air drag
        p.angle += p.angularVelocity;

        if (isEnding) {
          p.alpha -= p.decay * 3;
        } else {
          p.alpha -= p.decay;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'strip') {
          ctx.fillRect(-p.width / 2, -p.height / 4, p.width * 1.5, p.height / 2);
        } else {
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        }

        ctx.restore();
      }

      if (isActive && livingParticles > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    const timer = setTimeout(() => {
      isActive = false;
    }, durationMs + 2000);

    return () => {
      isActive = false;
      clearTimeout(timer);
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [durationMs, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60] w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
