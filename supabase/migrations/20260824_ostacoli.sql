-- Separa «dove sei» da «cosa c'e'».
--
-- Il problema
-- -----------
-- `spots.type` rispondeva a due domande insieme. Sui 118 spot pubblicati:
--
--   79  dicevano DOVE   street 60, park 11, plaza 5, pumptrack 3
--   39  dicevano COSA   ledge 18, rail 15, gap 4, bowl 2
--
-- Uno spot marcato `ledge` e' quasi sempre anche uno spot street, ma quel dato
-- non esisteva. E nei 60 street ci sono rail e scalinate che non risultavano da
-- nessuna parte. Per questo il filtro per tipo non aiutava a scegliere: non
-- perche' una categoria fosse troppo grande, ma perche' il campo era uno e le
-- domande due.
--
-- Cosa fa questa migration
-- ------------------------
-- 1. Aggiunge `ostacoli text[]` — cosa c'e' sullo spot, quanti se ne vuole.
-- 2. Ai 39 spot catalogati per ostacolo sposta il valore da `type` a
--    `ostacoli`. Il `type` NON viene toccato: assegnare il contesto giusto
--    richiede di guardare la foto, e la decisione e' di chi conosce gli spot.
--    Restano quindi visibili e funzionanti esattamente come adesso, e
--    compaiono nell'admin sotto «contesto da assegnare».
-- 3. Indice GIN per filtrare per ostacolo senza scansionare tutto.
--
-- Nessuna colonna rimossa, nessun dato perso, nessuno spot che smette di
-- funzionare. Si puo' eseguire mentre il sito e' online.
--
-- NB: `type` resta un ENUM Postgres con dentro anche rail/ledge/gap/bowl/
-- transition. Non si tolgono: ADD VALUE su un enum non e' reversibile e
-- toglierne uno richiederebbe di ricreare il tipo. Spariranno dall'interfaccia,
-- non dal database.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS ostacoli text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS spots_ostacoli_idx ON spots USING GIN (ostacoli);

-- I 39 spot filati per ostacolo: il valore si sposta nel campo giusto.
-- Solo se `ostacoli` e' ancora vuoto, cosi' rieseguire la migration non
-- duplica niente.
UPDATE spots
   SET ostacoli = ARRAY[type::text]
 WHERE type::text IN ('rail', 'ledge', 'gap', 'bowl')
   AND cardinality(ostacoli) = 0;

-- `transition` diventa due ostacoli: bank e quarter. E' cosi' che li chiamano
-- i rider, ed e' il motivo per cui non poteva essere una categoria — un bank
-- contro un muro in centro e' street, una quarter in un park e' park.
UPDATE spots
   SET ostacoli = ARRAY['bank', 'quarter']
 WHERE type::text = 'transition'
   AND cardinality(ostacoli) = 0;

-- Verifica dopo l'esecuzione:
--
--   select type, cardinality(ostacoli) as n_ostacoli, count(*)
--     from spots where status = 'approved'
--    group by 1, 2 order by 3 desc;
--
-- Atteso: i 39 con un ostacolo valorizzato, i 79 con ostacoli vuoti (si
-- riempiono col tempo, dai rider o dall'admin).
