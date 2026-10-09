'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
// @ts-ignore - plain JS module
import { createPet } from './pet-engine';

type Stats = { hunger: number; energy: number; mood: number };
type PetHandle = { act: (k: 'feed' | 'play' | 'rest' | 'pet') => void; getStats: () => Stats; destroy: () => void };

type Props = {
  /** Your existing Supabase client (browser client). */
  supabase: SupabaseClient;
  /** The signed-in user's id (auth.users.id). */
  userId: string;
  className?: string;
};

const SAVE_EVERY_MS = 15_000;

export default function PetCanvas({ supabase, userId, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petRef = useRef<PetHandle | null>(null);
  const [status, setStatus] = useState('Loading…');
  const [stats, setStats] = useState<Stats>({ hunger: 70, energy: 80, mood: 70 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let save: (() => void) | undefined;

    (async () => {
      try {
        // 1) load the saved pet (if any)
        const { data, error: loadErr } = await supabase
          .from('pets')
          .select('hunger, energy, mood, updated_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (loadErr) throw loadErr;
        if (cancelled || !canvasRef.current) return;

        const elapsed = data ? (Date.now() - new Date(data.updated_at).getTime()) / 1000 : 0;

        // 2) start the pet
        const pet: PetHandle = await createPet({
          canvas: canvasRef.current,
          initial: data ? { hunger: data.hunger, energy: data.energy, mood: data.mood } : undefined,
          elapsedSeconds: elapsed,
          onStatus: setStatus,
          onStats: setStats,
        });
        if (cancelled) { pet.destroy(); return; }
        petRef.current = pet;

        // 3) save his stats now, every 15s, and when the tab is hidden/closed
        save = () => {
          void supabase.from('pets').upsert({
            user_id: userId,
            ...pet.getStats(),
            updated_at: new Date().toISOString(),
          });
        };
        save();
        timer = setInterval(save, SAVE_EVERY_MS);
        window.addEventListener('pagehide', save);
        document.addEventListener('visibilitychange', onHidden);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Something went wrong loading your pet');
      }
    })();

    function onHidden() { if (document.visibilityState === 'hidden') save?.(); }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (save) { save(); window.removeEventListener('pagehide', save); }
      document.removeEventListener('visibilitychange', onHidden);
      petRef.current?.destroy();
      petRef.current = null;
    };
  }, [supabase, userId]);

  const bar = (label: string, value: number, color: string) => (
    <div style={{ fontSize: 12, opacity: 0.8 }}>
      {label}
      <div style={{ height: 10, background: 'rgba(0,0,0,.25)', borderRadius: 6, marginTop: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, transition: 'width .4s' }} />
      </div>
    </div>
  );

  const btn: React.CSSProperties = { padding: '10px 4px', borderRadius: 10, border: 0, cursor: 'pointer' };

  return (
    <div className={className} style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
        <strong>🧢 Your pet</strong>
        <span style={{ opacity: 0.7 }}>{error ?? status}</span>
      </div>
      <canvas ref={canvasRef} width={480} height={300} style={{ width: '100%', borderRadius: 14, cursor: 'pointer' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '12px 0' }}>
        {bar('Hunger', stats.hunger, '#ffb454')}
        {bar('Energy', stats.energy, '#5ad1ff')}
        {bar('Mood', stats.mood, '#ff7aa2')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <button style={btn} onClick={() => petRef.current?.act('feed')}>🍔 Feed</button>
        <button style={btn} onClick={() => petRef.current?.act('play')}>🎾 Play</button>
        <button style={btn} onClick={() => petRef.current?.act('rest')}>🛋️ Rest</button>
        <button style={btn} onClick={() => petRef.current?.act('pet')}>👋 Pet</button>
      </div>
    </div>
  );
}
