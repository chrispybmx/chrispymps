-- Dati del rider: in casa, e soprattutto NON pubblici.
--
-- Perché una tabella separata invece di nuove colonne su `profiles`:
-- `profiles` ha la policy `profiles_public_read` (SELECT, USING true), perché
-- i profili sono pubblici sulla mappa. La chiave anon del sito sta nel browser
-- di ogni visitatore, quindi qualunque colonna aggiunta lì è scaricabile da
-- chiunque. Una data di nascita di minorenni pubblica sarebbe un incidente,
-- non una scelta.
--
-- Qui invece: ognuno vede e scrive solo la propria riga; nessun altro legge
-- niente. Le statistiche aggregate per il media kit si calcolano server-side
-- con il service role, che salta RLS.

CREATE TABLE IF NOT EXISTS rider_details (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date   date,
  region       text,
  disciplines  text[],
  riding_since_year integer,   -- anno vero, non una fascia
  setup_brand  text,

  -- Consenso newsletter: la spunta E il momento. Tenerlo qui, e non solo nel
  -- provider di email, è ciò che lo rende dimostrabile se qualcuno lo chiede.
  newsletter_opt_in    boolean     NOT NULL DEFAULT false,
  newsletter_opt_in_at timestamptz,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

/* ── Vincoli, scritti a parte così la migration è ri-eseguibile ── */

-- Anno di inizio: teniamo il dato vero. Da un anno si ricava la fascia,
-- dalla fascia non si torna indietro.
ALTER TABLE rider_details DROP CONSTRAINT IF EXISTS rider_details_riding_year_check;
ALTER TABLE rider_details ADD CONSTRAINT rider_details_riding_year_check
  CHECK (riding_since_year IS NULL OR (riding_since_year >= 1970 AND riding_since_year <= EXTRACT(YEAR FROM current_date)));

ALTER TABLE rider_details DROP CONSTRAINT IF EXISTS rider_details_disciplines_check;
ALTER TABLE rider_details ADD CONSTRAINT rider_details_disciplines_check
  CHECK (disciplines IS NULL OR disciplines <@ ARRAY['bmx','skate','scooter','altro']::text[]);

-- Data plausibile: niente futuro, niente 1890.
ALTER TABLE rider_details DROP CONSTRAINT IF EXISTS rider_details_birth_date_check;
ALTER TABLE rider_details ADD CONSTRAINT rider_details_birth_date_check
  CHECK (birth_date IS NULL OR (birth_date > '1920-01-01' AND birth_date < current_date));

/* ── Accesso: solo il diretto interessato ── */

ALTER TABLE rider_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rider_details_own_read   ON rider_details;
DROP POLICY IF EXISTS rider_details_own_insert ON rider_details;
DROP POLICY IF EXISTS rider_details_own_update ON rider_details;

CREATE POLICY rider_details_own_read   ON rider_details FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY rider_details_own_insert ON rider_details FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY rider_details_own_update ON rider_details FOR UPDATE USING (auth.uid() = user_id);
-- Nessuna policy di DELETE: la riga se ne va con l'utente (ON DELETE CASCADE).

CREATE INDEX IF NOT EXISTS idx_rider_details_region      ON rider_details(region) WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rider_details_disciplines ON rider_details USING gin(disciplines);

COMMENT ON TABLE  rider_details            IS 'Dati personali del rider. Non pubblici: leggibili solo dal diretto interessato e dal service role.';
COMMENT ON COLUMN rider_details.disciplines IS 'bmx | skate | scooter | altro — multipla: molti fanno due cose';
COMMENT ON COLUMN rider_details.birth_date  IS 'Fasce d''età aggregate per il media kit, e regola sui minorenni (niente marketing sotto i 16)';

/* ── Vista aggregata: il numero che si vende, senza nessun dato personale ──
   Nessuna riga identifica una persona. Da qui esce la frase del media kit
   ("il 34% è in Veneto"), e non serve nessun consenso per costruirla. */

CREATE OR REPLACE VIEW rider_stats_aggregate AS
SELECT
  region,
  unnest(coalesce(disciplines, ARRAY['non dichiarato'])) AS disciplina,
  riding_since_year,
  CASE
    WHEN birth_date IS NULL THEN 'non dichiarata'
    WHEN age(birth_date) < interval '14 years' THEN 'under 14'
    WHEN age(birth_date) < interval '18 years' THEN '14-17'
    WHEN age(birth_date) < interval '25 years' THEN '18-24'
    WHEN age(birth_date) < interval '35 years' THEN '25-34'
    WHEN age(birth_date) < interval '45 years' THEN '35-44'
    ELSE '45+'
  END AS fascia_eta,
  count(*) AS rider
FROM rider_details
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW rider_stats_aggregate IS 'Statistiche aggregate per il media kit. Nessun dato personale.';
