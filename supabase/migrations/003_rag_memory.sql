-- 003_rag_memory.sql
-- RAG document chunks, matter memory, and user memory with pgvector

CREATE EXTENSION IF NOT EXISTS vector;

-- Document embeddings table
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id uuid,
  document_name text NOT NULL,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(1024),
  source text DEFAULT 'vault',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own chunks" ON document_chunks FOR ALL USING (auth.uid() = user_id);

-- Matter memory table
CREATE TABLE IF NOT EXISTS matter_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  content text NOT NULL,
  embedding vector(1024),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX ON matter_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
ALTER TABLE matter_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own matter memory" ON matter_memory FOR ALL USING (auth.uid() = user_id);

-- User memory table
CREATE TABLE IF NOT EXISTS user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  content text NOT NULL,
  embedding vector(1024),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX ON user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own memory" ON user_memory FOR ALL USING (auth.uid() = user_id);

-- Similarity search RPC functions

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1024),
  match_user_id uuid,
  match_count int DEFAULT 5,
  match_matter_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, document_name text, chunk_text text, similarity float, source text, matter_id uuid)
LANGUAGE sql STABLE AS $$
  SELECT dc.id, dc.document_name, dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.source, dc.matter_id
  FROM document_chunks dc
  WHERE dc.user_id = match_user_id
    AND (match_matter_id IS NULL OR dc.matter_id = match_matter_id)
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_matter_memory(
  query_embedding vector(1024),
  match_matter_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, content text, memory_type text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT mm.id, mm.content, mm.memory_type,
    1 - (mm.embedding <=> query_embedding) AS similarity
  FROM matter_memory mm
  WHERE mm.matter_id = match_matter_id AND mm.embedding IS NOT NULL
  ORDER BY mm.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_user_memory(
  query_embedding vector(1024),
  match_user_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, content text, memory_type text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT um.id, um.content, um.memory_type,
    1 - (um.embedding <=> query_embedding) AS similarity
  FROM user_memory um
  WHERE um.user_id = match_user_id AND um.embedding IS NOT NULL
  ORDER BY um.embedding <=> query_embedding
  LIMIT match_count;
$$;
