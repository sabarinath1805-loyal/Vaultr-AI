CREATE TABLE IF NOT EXISTS tabular_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  document_type text,
  columns jsonb NOT NULL DEFAULT '[]',
  document_ids jsonb NOT NULL DEFAULT '[]',
  results jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tabular_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own reviews" ON tabular_reviews FOR ALL USING (auth.uid() = user_id);
