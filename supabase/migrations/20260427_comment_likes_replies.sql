-- ============================================================
-- MIGRAZIONE: like + risposte ai commenti
-- Esegui nel Supabase SQL Editor:
-- https://supabase.com/dashboard/project/aoiuzmidvbfukemkhajk/sql/new
-- ============================================================

-- 1. Aggiungi colonne alla tabella comments
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS likes_count int4 NOT NULL DEFAULT 0;

-- 2. Crea tabella comment_likes
CREATE TABLE IF NOT EXISTS comment_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- 3. RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_read_all') THEN
    CREATE POLICY comment_likes_read_all     ON comment_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_insert_own') THEN
    CREATE POLICY comment_likes_insert_own   ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_delete_own') THEN
    CREATE POLICY comment_likes_delete_own   ON comment_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Funzione trigger per aggiornare likes_count automaticamente
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_likes_count ON comment_likes;
CREATE TRIGGER trg_comment_likes_count
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();
