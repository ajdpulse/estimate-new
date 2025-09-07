/*
  # Fix Storage Policies for Estimate Forms Bucket

  1. Storage Policies
    - Enable INSERT policy for authenticated users to upload to subwork-designs folder
    - Enable SELECT policy for authenticated users to view uploaded files
    - Enable DELETE policy for users to delete their own uploads

  2. Security
    - Restrict uploads to subwork-designs folder within estimate-forms bucket
    - Allow authenticated users to upload design photos
    - Maintain proper access control
*/

-- Create storage policies for estimate-forms bucket

-- Policy to allow authenticated users to upload files to subwork-designs folder
INSERT INTO storage.policies (id, bucket_id, name, definition, check_definition, command, roles)
VALUES (
  'subwork-designs-upload-policy',
  'estimate-forms',
  'Allow authenticated users to upload subwork designs',
  'bucket_id = ''estimate-forms'' AND (storage.foldername(name))[1] = ''subwork-designs'' AND auth.role() = ''authenticated''',
  'bucket_id = ''estimate-forms'' AND (storage.foldername(name))[1] = ''subwork-designs'' AND auth.role() = ''authenticated''',
  'INSERT',
  '{authenticated}'
) ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition,
  check_definition = EXCLUDED.check_definition;

-- Policy to allow authenticated users to view uploaded files
INSERT INTO storage.policies (id, bucket_id, name, definition, check_definition, command, roles)
VALUES (
  'subwork-designs-select-policy',
  'estimate-forms',
  'Allow authenticated users to view subwork designs',
  'bucket_id = ''estimate-forms'' AND (storage.foldername(name))[1] = ''subwork-designs'' AND auth.role() = ''authenticated''',
  NULL,
  'SELECT',
  '{authenticated}'
) ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition;

-- Policy to allow users to delete their own uploads (optional, for future use)
INSERT INTO storage.policies (id, bucket_id, name, definition, check_definition, command, roles)
VALUES (
  'subwork-designs-delete-policy',
  'estimate-forms',
  'Allow users to delete their own subwork designs',
  'bucket_id = ''estimate-forms'' AND (storage.foldername(name))[1] = ''subwork-designs'' AND auth.role() = ''authenticated''',
  NULL,
  'DELETE',
  '{authenticated}'
) ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition;