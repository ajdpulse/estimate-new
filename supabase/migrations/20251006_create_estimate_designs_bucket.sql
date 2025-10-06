/*
  # Create Storage Bucket for Estimate Designs

  1. Storage Setup
    - Create `estimate-designs` storage bucket for design/diagram uploads
    - Set bucket to public for easy preview access
    - Configure file size limit to 50MB

  2. Security
    - Enable RLS on storage.objects
    - Add policy for authenticated users to upload files
    - Add policy for public to view files (since bucket is public)
    - Add policy for authenticated users to delete their own files

  3. Notes
    - Bucket is set to public for easy access to design previews
    - Maximum file size: 50MB (52428800 bytes)
*/

-- Insert the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-designs',
  'estimate-designs',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/acad',
    'application/x-acad',
    'application/autocad_dwg',
    'image/x-dwg',
    'image/vnd.dwg',
    'drawing/x-dwg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Policy: Allow authenticated users to upload files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload estimate designs'
  ) THEN
    CREATE POLICY "Authenticated users can upload estimate designs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'estimate-designs');
  END IF;
END $$;

-- Policy: Allow public to view files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view estimate designs'
  ) THEN
    CREATE POLICY "Public can view estimate designs"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'estimate-designs');
  END IF;
END $$;

-- Policy: Allow authenticated users to view files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view estimate designs'
  ) THEN
    CREATE POLICY "Authenticated users can view estimate designs"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'estimate-designs');
  END IF;
END $$;

-- Policy: Allow authenticated users to update their own files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own estimate designs'
  ) THEN
    CREATE POLICY "Users can update own estimate designs"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'estimate-designs' AND auth.uid()::text = owner)
    WITH CHECK (bucket_id = 'estimate-designs' AND auth.uid()::text = owner);
  END IF;
END $$;

-- Policy: Allow authenticated users to delete their own files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own estimate designs'
  ) THEN
    CREATE POLICY "Users can delete own estimate designs"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'estimate-designs' AND auth.uid()::text = owner);
  END IF;
END $$;
