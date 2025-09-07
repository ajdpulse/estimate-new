/*
  # Fix RLS Policies for Subwork Design Photos

  1. Security
    - Enable RLS on `subwork_design_photos` table
    - Add policy for authenticated users to insert their own photos
    - Add policy for users to read photos for subworks they have access to
    - Add policy for users to delete their own photos
    - Add policy for admins to manage all photos

  2. Changes
    - Enable Row Level Security
    - Create INSERT policy for authenticated users
    - Create SELECT policy for users with subwork access
    - Create DELETE policy for photo owners and admins
*/

-- Enable RLS on subwork_design_photos table
ALTER TABLE estimate.subwork_design_photos ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to insert photos
CREATE POLICY "Users can insert design photos for accessible subworks"
  ON estimate.subwork_design_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate.subworks s
      WHERE s.subworks_id = subwork_design_photos.subwork_id
    )
  );

-- Policy for users to read photos for subworks they have access to
CREATE POLICY "Users can read design photos for accessible subworks"
  ON estimate.subwork_design_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimate.subworks s
      WHERE s.subworks_id = subwork_design_photos.subwork_id
    )
  );

-- Policy for users to delete their own photos
CREATE POLICY "Users can delete their own design photos"
  ON estimate.subwork_design_photos
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Policy for admins to manage all photos
CREATE POLICY "Admins can manage all design photos"
  ON estimate.subwork_design_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  );