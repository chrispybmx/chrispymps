-- Soft-delete degli spot da parte del proprietario.
--
-- L'owner puo cancellare uno spot che ha pubblicato. Invece di un hard delete
-- (rischioso: le tabelle figlie spot_photos/spot_likes/spot_ratings/commenti
-- potrebbero non avere ON DELETE CASCADE -> errore o righe orfane) si usa un
-- soft-delete: status = 'deleted'. Lo spot sparisce ovunque perche mappa,
-- API /api/spots e la pagina /map/spot/[slug] filtrano gia status = 'approved'.
-- Reversibile: basta rimettere lo status precedente dal pannello admin.
--
-- status e un ENUM Postgres (spot_status): serve aggiungere il valore.
-- ALTER TYPE ... ADD VALUE va eseguito come statement isolato (non dentro una
-- transazione che poi usa subito il valore) — nel SQL editor e ok.

ALTER TYPE spot_status ADD VALUE IF NOT EXISTS 'deleted';
