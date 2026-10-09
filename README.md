# Pixel Pet kit

Your character, animated, saved per user in Supabase. Built for Next.js (App Router) but the engine is plain JavaScript, so it works in any framework.

## What's inside

| File | What it is |
|---|---|
| `public/pet/atlas.png` + `atlas.json` | Your sprite sheet, cut out with transparent background |
| `src/pet/pet-engine.js` | The pet itself: drawing + behaviour. No framework needed |
| `src/pet/PetCanvas.tsx` | Next.js/React component: canvas, stat bars, buttons, Supabase saving |
| `supabase/migrations/…_create_pets.sql` | Creates the `pets` table with per-user security |

## Setup (about 5 minutes)

1. **Copy the files into your project** (VS Code): `public/pet/*` → your `public/` folder, `src/pet/*` → your `src/` folder (keep the folder names).
2. **Create the table in Supabase**: open your project → *SQL Editor* → paste the contents of the `.sql` file → *Run*.
   (If you use the Supabase CLI, drop the file into `supabase/migrations/` and run `supabase db push`.)
3. **Show the pet on a page** (the user must be signed in):

   ```tsx
   // app/pet/page.tsx
   'use client';
   import { useEffect, useState } from 'react';
   import { createClient } from '@/lib/supabase/client'; // <- your existing browser client
   import PetCanvas from '@/src/pet/PetCanvas';           // <- adjust the path to where you put it

   export default function PetPage() {
     const [supabase] = useState(() => createClient());
     const [userId, setUserId] = useState<string | null>(null);
     useEffect(() => {
       supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
     }, [supabase]);
     if (!userId) return <p>Sign in to meet your pet.</p>;
     return <PetCanvas supabase={supabase} userId={userId} />;
   }
   ```
4. **Deploy**: `git add . && git commit -m "Add pixel pet" && git push`. Vercel deploys on its own.

## Good to know

- The pet's stats are saved every 15 seconds and when the tab closes. When the user comes back, he is a bit hungrier and sleepier. Time away counts at half speed, up to 12 hours.
- Row Level Security means each user can only read and change their own pet.
- To change how he behaves, edit `ANIMS` (which frames play) and `think()` / `act()` in `pet-engine.js`.
- He gets hungry over roughly 6 hours. To watch it happen in minutes while testing, pass `speed: 60` to `createPet`.
- To drop the sky/grass backdrop and put him on your own background, pass `stage: false` to `createPet`.
