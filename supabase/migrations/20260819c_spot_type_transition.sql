-- Nuova categoria di spot: transition.
--
-- Perché: `street` raccoglieva 60 spot su 116, cioè più della metà del
-- database in un'unica etichetta. Ma "street" e "transition" sono due
-- famiglie di terreno diverse, non due sfumature: sullo street si gira su
-- spigoli e piani (ledge, rail, scale, gap), sulla transition su superfici
-- curve che restituiscono velocità (quarter, bank, ramp, gobbe). Un rider
-- che cerca l'una raramente vuole l'altra, e finché stanno insieme il
-- filtro per tipo non serve a scegliere.
--
-- NB: `spot_type` è un ENUM Postgres, non testo libero (vedi tasks/lessons.md,
-- 2026-07-22): un valore fuori enum dà `22P02 invalid input value for enum`.
-- Va aggiunto esplicitamente, e ADD VALUE non è reversibile con un DROP —
-- per toglierlo servirebbe ricreare il tipo.

ALTER TYPE spot_type ADD VALUE IF NOT EXISTS 'transition';

-- Nessuna ri-categorizzazione automatica dei 60 spot `street` esistenti:
-- capire quali siano transition richiede di guardare le foto una per una, e
-- la decisione è di chi conosce gli spot. Si può fare a mano dall'admin, o
-- lasciarla alla community man mano che passa.
--
-- Per vedere come sono distribuiti oggi:
--   SELECT type, count(*) FROM spots WHERE status = 'approved'
--    GROUP BY type ORDER BY count(*) DESC;
