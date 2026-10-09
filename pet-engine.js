/**
 * Pixel Pet engine - plain JavaScript, no framework needed.
 * Draws your character from public/pet/atlas.png onto a <canvas>,
 * and runs the pet's behaviour (idle / walk / sit / nap / happy / angry).
 *
 *   const pet = await createPet({ canvas, onStats, onStatus });
 *   pet.act('feed' | 'play' | 'rest' | 'pet');
 *   pet.getStats();   // { hunger, energy, mood }  (0-100)
 *   pet.destroy();
 */

export const DEFAULT_STATS = { hunger: 70, energy: 80, mood: 70 };

// Which frames of which atlas row to play for each behaviour.
const ANIMS = {
  idle:   { s: 'idle',  f: [0, 1, 2, 3, 4, 5, 6, 7], fps: 2.5 },
  walk:   { s: 'walk',  f: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9 },
  sit:    { s: 'sit_a', f: [0, 1, 2, 3, 5, 3],       fps: 2 },
  chair:  { s: 'sit_b', f: [1, 2, 3, 4],             fps: 2 },
  nap:    { s: 'sit_b', f: [6, 7],                   fps: 1.5 },
  happy:  { s: 'happy', f: [0, 1, 2, 3, 4, 5],       fps: 4 },
  jump:   { s: 'happy', f: [3, 4, 5, 4],             fps: 6 },
  thumbs: { s: 'happy', f: [6],                      fps: 1 },
  angry:  { s: 'angry', f: [0, 1, 2, 3, 4, 5, 6],    fps: 3.5 },
};

const SAY = {
  idle: 'Just chilling…', walk: 'Out for a stroll!', sit: 'Taking a break…',
  chair: 'Sitting down…', nap: 'So sleepy… 😴', happy: 'Yay!! 😄',
  jump: 'Wheee! 🎾', thumbs: 'Thanks! 👍', angry: 'Hmph! 😤',
};

const RESTING = ['sit', 'chair', 'nap'];

// How fast stats fall, in points per second at speed 1 (about 100 points per 6-8 hours).
const RATE = {
  hunger: 100 / (6 * 3600),
  energy: 100 / (8 * 3600),
  energyWalking: 100 / (4 * 3600),
  mood: 100 / (10 * 3600),
  moodHungry: 100 / (4 * 3600),
};
const clamp = (v) => Math.max(0, Math.min(100, v));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + src));
    img.src = src;
  });
}

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {string}  [opts.atlasUrl='/pet/atlas.png']
 * @param {string}  [opts.metaUrl='/pet/atlas.json']
 * @param {{hunger:number,energy:number,mood:number}} [opts.initial]  saved stats
 * @param {number}  [opts.elapsedSeconds=0]  time since the stats were saved (offline decay)
 * @param {boolean} [opts.stage=true]  draw the sky/grass backdrop (false = transparent canvas)
 * @param {number}  [opts.scale=1.2]
 * @param {number}  [opts.speed=1]  stat decay multiplier (use 60 to watch him get hungry in minutes while testing)
 * @param {(text:string)=>void} [opts.onStatus]  called when his mood message changes
 * @param {(stats:object)=>void} [opts.onStats]  called about once a second and after each action
 */
export async function createPet(opts) {
  const {
    canvas,
    atlasUrl = '/pet/atlas.png',
    metaUrl = '/pet/atlas.json',
    initial,
    elapsedSeconds = 0,
    stage = true,
    scale = 1.2,
    speed = 1,
    onStatus = () => {},
    onStats = () => {},
  } = opts;

  const ctx = canvas.getContext('2d');
  const [meta, atlas] = await Promise.all([
    fetch(metaUrl).then((r) => {
      if (!r.ok) throw new Error('Could not load ' + metaUrl);
      return r.json();
    }),
    loadImage(atlasUrl),
  ]);

  const st = { ...DEFAULT_STATS, ...(initial || {}) };
  const pet = { anim: 'idle', t0: 0, until: 0, x: canvas.width / 2, dir: 1, forced: false };
  let raf = 0;
  let destroyed = false;

  function decay(s) {
    const resting = RESTING.includes(pet.anim);
    const k = s * speed;
    st.hunger = clamp(st.hunger - RATE.hunger * k);
    st.energy = clamp(st.energy - (pet.anim === 'walk' ? RATE.energyWalking : resting ? 0 : RATE.energy) * k);
    st.mood = clamp(st.mood - (st.hunger < 30 ? RATE.moodHungry : RATE.mood) * k);
  }
  // Catch-up for time spent away: up to 12h, counted at half speed so coming back isn't punishing.
  decay(Math.min(Math.max(elapsedSeconds, 0), 12 * 3600) * 0.5);

  const now = () => performance.now();
  function setState(anim, dur, forced = false, msg) {
    pet.anim = anim;
    pet.t0 = now() / 1000;
    pet.until = now() + dur * 1000;
    pet.forced = forced;
    onStatus(msg || SAY[anim]);
  }

  function think() {
    if (st.hunger < 20) return setState('angry', 4, false, 'Feed me!! 😠');
    if (st.mood < 25) return setState('angry', 4, false, "I'm upset 😤");
    if (st.energy < 25) return setState('nap', 6);
    const r = Math.random();
    if (st.mood > 80 && r < 0.2) return setState('happy', 3);
    if (r < 0.45) return setState('idle', 4 + Math.random() * 3);
    if (r < 0.8) return setState('walk', 3 + Math.random() * 4);
    return setState(Math.random() < 0.5 ? 'sit' : 'chair', 4 + Math.random() * 3);
  }

  function act(kind) {
    if (kind === 'feed') {
      st.hunger = clamp(st.hunger + 30); st.mood = clamp(st.mood + 5);
      setState('happy', 3, true, 'Nom nom nom 🍔');
    } else if (kind === 'play') {
      if (st.energy < 15) { setState('angry', 2.5, true, 'Too tired to play! 😤'); }
      else {
        st.mood = clamp(st.mood + 20); st.energy = clamp(st.energy - 10); st.hunger = clamp(st.hunger - 5);
        setState('jump', 3);
      }
    } else if (kind === 'rest') {
      st.energy = clamp(st.energy + 25);
      setState('nap', 6, true, 'Zzz… 😴');
    } else if (kind === 'pet') {
      st.mood = clamp(st.mood + 8);
      setState('thumbs', 1.8, true);
    }
    onStats({ ...st });
  }

  function render(t) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const floorY = H * 0.9;
    if (stage) {
      ctx.fillStyle = '#8fd0ff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      [[0.08, 0.13], [0.62, 0.2], [0.83, 0.09]].forEach(([x, y]) => {
        ctx.fillRect(W * x, H * y, 60, 14); ctx.fillRect(W * x + 14, H * y - 10, 34, 12);
      });
      ctx.fillStyle = '#6cc46a'; ctx.fillRect(0, H * 0.84, W, H * 0.16);
      ctx.fillStyle = '#58ab56'; ctx.fillRect(0, H * 0.84, W, 6);
    }
    const A = ANIMS[pet.anim], M = meta.states[A.s];
    const k = A.f[Math.floor(Math.max(0, t - pet.t0) * A.fps) % A.f.length];
    const dw = M.w * scale, dh = M.h * scale;

    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(pet.x, floorY, 38, 7, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(pet.x, floorY);
    if (pet.anim === 'walk' && pet.dir < 0) ctx.scale(-1, 1); // the sheet walks to the right
    ctx.drawImage(atlas, k * M.w, M.y, M.w, M.h, -dw / 2, -dh + 3 * scale, dw, dh);
    ctx.restore();
  }

  let prev = now(), acc = 0;
  function frame(ts) {
    if (destroyed) return;
    const t = now();
    const dt = Math.min((t - prev) / 1000, 0.1); prev = t; acc += dt;
    if (acc >= 1) { decay(acc); acc = 0; onStats({ ...st }); }
    if (t > pet.until) think();
    if (RESTING.includes(pet.anim)) st.energy = clamp(st.energy + (pet.forced ? 1.5 : 0.5) * dt);
    if (pet.anim === 'walk') {
      pet.x += pet.dir * 50 * dt;
      const lo = canvas.width * 0.17, hi = canvas.width * 0.83;
      if (pet.x > hi) { pet.x = hi; pet.dir = -1; }
      if (pet.x < lo) { pet.x = lo; pet.dir = 1; }
    }
    render(t / 1000);
    raf = requestAnimationFrame(frame);
  }

  const onClick = () => act('pet');
  canvas.addEventListener('click', onClick);

  onStats({ ...st });
  think();
  raf = requestAnimationFrame(frame);

  return {
    act,
    getStats: () => ({ ...st }),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onClick);
    },
  };
}
