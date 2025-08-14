/*
  # Create Measurement Book Table

  1. New Tables
    - `measurement_book`
      - `id` (uuid, primary key)
      - `work_id` (text, references works)
      - `subwork_id` (text, references subworks)
      - `item_id` (uuid, references subwork_items)
      - `measurement_sr_no` (integer)
      - `description_of_items` (text)
      - `no_of_units` (integer)
      - `length` (decimal)
      - `width_breadth` (decimal)
      - `height_depth` (decimal)
      - `estimated_quantity` (decimal)
      - `actual_quantity` (decimal)
      - `variance` (decimal)
      - `variance_reason` (text)
      - `unit` (text)
      - `measured_by` (uuid, references auth.users)
      - `measured_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `measurement_book` table
    - Add policies for authenticated users to manage their measurements
    - Add policies for admins to view all measurements

  3. Indexes
    - Add indexes for efficient querying by work_id, subwork_id, item_id
*/

-- Create measurement_book table
CREATE TABLE IF NOT EXISTS estimate.measurement_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id TEXT NOT NULL,
  subwork_id TEXT NOT NULL,
  item_id UUID NOT NULL,
  measurement_sr_no INTEGER NOT NULL,
  description_of_items TEXT,
  no_of_units INTEGER DEFAULT 1,
  length DECIMAL(10,3) DEFAULT 0,
  width_breadth DECIMAL(10,3) DEFAULT 0,
  height_depth DECIMAL(10,3) DEFAULT 0,
  estimated_quantity DECIMAL(10,3) DEFAULT 0,
  actual_quantity DECIMAL(10,3) DEFAULT 0,
  variance DECIMAL(10,3) DEFAULT 0,
  variance_reason TEXT,
  unit TEXT,
  measured_by UUID REFERENCES auth.users(id),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key constraints
  CONSTRAINT fk_measurement_work FOREIGN KEY (work_id) REFERENCES estimate.works(works_id) ON DELETE CASCADE,
  CONSTRAINT fk_measurement_subwork FOREIGN KEY (subwork_id) REFERENCES estimate.subworks(subworks_id) ON DELETE CASCADE,
  CONSTRAINT fk_measurement_item FOREIGN KEY (item_id) REFERENCES estimate.subwork_items(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE estimate.measurement_book ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_measurement_book_work_id ON estimate.measurement_book(work_id);
CREATE INDEX IF NOT EXISTS idx_measurement_book_subwork_id ON estimate.measurement_book(work_id, subwork_id);
CREATE INDEX IF NOT EXISTS idx_measurement_book_item_id ON estimate.measurement_book(item_id);
CREATE INDEX IF NOT EXISTS idx_measurement_book_measured_by ON estimate.measurement_book(measured_by);

-- RLS Policies
CREATE POLICY "Users can read own measurements"
  ON estimate.measurement_book
  FOR SELECT
  TO authenticated
  USING (measured_by = auth.uid());

CREATE POLICY "Users can insert own measurements"
  ON estimate.measurement_book
  FOR INSERT
  TO authenticated
  WITH CHECK (measured_by = auth.uid());

CREATE POLICY "Users can update own measurements"
  ON estimate.measurement_book
  FOR UPDATE
  TO authenticated
  USING (measured_by = auth.uid())
  WITH CHECK (measured_by = auth.uid());

CREATE POLICY "Admins can read all measurements"
  ON estimate.measurement_book
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  );

CREATE POLICY "Admins can manage all measurements"
  ON estimate.measurement_book
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('super_admin', 'admin', 'developer')
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION estimate.update_measurement_book_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_measurement_book_updated_at
  BEFORE UPDATE ON estimate.measurement_book
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_measurement_book_updated_at();