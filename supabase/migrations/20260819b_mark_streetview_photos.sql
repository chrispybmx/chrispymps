-- Foto riconosciute come screenshot Google Maps / Street View
-- Identificate visivamente il 19/08/2026 su tutte le 116 copertine.
-- Prove: status bar del telefono, logo Google, "© 2026 Google", barra
-- indirizzo, frecce di navigazione, pin rossi, dialog "Share Street View?".
-- Totale: 26 su 116.

UPDATE spot_photos SET source = 'streetview' WHERE url IN (
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/15b00986-f9fe-47dc-a872-802abee6cf95_1777920049909.jpg',  -- Rail (Asnago di Cermenate)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/8911ae5f-f5ce-42f7-bd1e-c0efe57627ed/0.png',  -- Rail (Capiago Intimiano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/429f983c-f1ec-44e0-a8be-c65e15d9fad2_1779922138629.jpg',  -- Steep kink rail (Casatenovo)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/cbda05e1-49d5-4a14-b924-4a13cadfab7d/0.jpg',  -- Piazzetta con bank rail e gap (Casazza)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/e29a8c69-7831-4b93-8652-10e83b877568/0.png',  -- Muretto in discesa (Cesano Maderno)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/2753bae8-ec81-46bc-9088-c3e2df9b8d1c/0.png',  -- Bank rosso (Giussano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/7f70216b-75ea-482a-984c-a6fd4c614bef/0.png',  -- Fontana spot (Giussano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/0d46104d-4cff-411d-b581-a2f99bf33ab3/0.png',  -- Gap / ledge (Giussano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/1ac0607d-03e9-4697-8f93-d77ec26cf23e/0.png',  -- Gap easy (Giussano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/cba0c096-c79f-40c2-9f72-8b280c9caaff/0.png',  -- Muretti grindabili/sgheppabili (Giussano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/b02a825b-2693-4a98-8ecd-c7750d80e918/0.png',  -- Rail a destra (Meda)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/c7dd33a3-1d9d-4d48-878a-70b022a18a76/0.png',  -- rail in discesa (Meda)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/15b00986-f9fe-47dc-a872-802abee6cf95_1777919952858.jpg',  -- Rail (Montesordo)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/5f33dffb-0eb5-4ced-b313-e4f3bb1552e4/0.png',  -- Flatbar lunga (Parma)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/e35b74b0-dbf1-4672-a7b7-57aeefbef71b/0.png',  -- Up muretto to rail in discesa (Parma)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/429f983c-f1ec-44e0-a8be-c65e15d9fad2_1779922357980.jpg',  -- Long flatbar (Sant'Angelo Lodigiano)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/429f983c-f1ec-44e0-a8be-c65e15d9fad2_1779921799898.jpg',  -- Fontana con banks (Seregno)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/f8bb87e5-a329-4caa-9f9f-0c02845ecfc8/0.jpg',  -- Set stair da (Treviglio)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/0af67178-7656-4e2c-8481-e85f6faef926_1784441762622.jpg',  -- Cino (Valencia)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/429f983c-f1ec-44e0-a8be-c65e15d9fad2_1779921549908.jpg',  -- Rail in discesa cimitero di verano (Verano Brianza)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/uploads/ae1f172d-60a9-432d-a3cb-16e0cd42a6ca_1783603826122.jpg',  -- 2 quarter della chiesa (Verona)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/f8ab0251-fc34-4be1-b387-669d7b3f77c8/0.png',  -- Rail con gradini (Vertemate con Minoprio)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/59e0c5ab-6b16-4ca6-9f66-9031e9cafbaf/0.png',  -- Skate park austria (Zirl)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/39d6516b-bb64-4f52-8d9f-16b7b24635ba/0.png',  -- Manny pad o panchina hop (silandro)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/de953962-158e-4f2b-99d5-78a42c75feff/0.png',  -- Panchina (silandro)
  'https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/b9d33422-3980-46f0-9259-1815c82d780b/0.png'  -- Rail quadrato Ciccio + una cosa strana (silandro)
);
