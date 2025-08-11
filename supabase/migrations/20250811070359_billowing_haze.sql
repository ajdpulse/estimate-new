/*
  # Create item rates table with sr_no as primary key

  1. New Tables
    - `item_rates`
      - `sr_no` (serial, primary key)
      - `subwork_item_id` (uuid, foreign key to subwork_items)
      - `description` (text, rate description/material name)
      - `rate` (numeric, rate amount)
      - `unit` (text, unit of measurement)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid, foreign key to users)

  2. Security
    - Enable RLS on `item_rates` table
    - Add policies for authenticated users to manage their own rates
    - Add policies for admins to manage all rates

  3. Triggers
    - Add trigger to automatically update `updated_at` timestamp
*/

-- Create the item_rates table
CREATE TABLE IF NOT EXISTS estimate.item_rates (
  sr_no SERIAL PRIMARY KEY,
  subwork_item_id uuid NOT NULL,
  description text NOT NULL,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  unit text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add foreign key constraint to subwork_items
ALTER TABLE estimate.item_rates 
ADD CONSTRAINT item_rates_subwork_item_id_fkey 
FOREIGN KEY (subwork_item_id) 
REFERENCES estimate.subwork_items(id) 
ON DELETE CASCADE;

-- Add foreign key constraint to users
ALTER TABLE estimate.item_rates 
ADD CONSTRAINT item_rates_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_rates_subwork_item_id 
ON estimate.item_rates(subwork_item_id);

CREATE INDEX IF NOT EXISTS idx_item_rates_created_by 
ON estimate.item_rates(created_by);

-- Enable Row Level Security
ALTER TABLE estimate.item_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Policy: Users can read rates for items they have access to
CREATE POLICY "Users can read item rates for accessible items"
ON estimate.item_rates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM estimate.subwork_items si
    JOIN estimate.subworks sw ON si.subwork_id = sw.subworks_id
    JOIN estimate.works w ON sw.works_id = w.works_id
    WHERE si.id = item_rates.subwork_item_id
    AND (w.created_by = auth.uid() OR si.created_by = auth.uid())
  )
);

-- Policy: Users can insert rates for items they created
CREATE POLICY "Users can insert rates for own items"
ON estimate.item_rates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM estimate.subwork_items si
    WHERE si.id = item_rates.subwork_item_id
    AND si.created_by = auth.uid()
  )
);

-- Policy: Users can update rates for items they created
CREATE POLICY "Users can update rates for own items"
ON estimate.item_rates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM estimate.subwork_items si
    WHERE si.id = item_rates.subwork_item_id
    AND si.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM estimate.subwork_items si
    WHERE si.id = item_rates.subwork_item_id
    AND si.created_by = auth.uid()
  )
);

-- Policy: Users can delete rates for items they created
CREATE POLICY "Users can delete rates for own items"
ON estimate.item_rates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM estimate.subwork_items si
    WHERE si.id = item_rates.subwork_item_id
    AND si.created_by = auth.uid()
  )
);

-- Policy: Admins can manage all rates
CREATE POLICY "Admins can manage all item rates"
ON estimate.item_rates
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

-- Create trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION estimate.update_item_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_item_rates_updated_at
  BEFORE UPDATE ON estimate.item_rates
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_item_rates_updated_at();

-- Add comments for documentation
COMMENT ON TABLE estimate.item_rates IS 'Stores multiple rates for each subwork item';
COMMENT ON COLUMN estimate.item_rates.sr_no IS 'Serial number primary key';
COMMENT ON COLUMN estimate.item_rates.subwork_item_id IS 'Reference to the subwork item';
COMMENT ON COLUMN estimate.item_rates.description IS 'Description of the rate (material/work type)';
COMMENT ON COLUMN estimate.item_rates.rate IS 'Rate amount in currency';
COMMENT ON COLUMN estimate.item_rates.unit IS 'Unit of measurement';
COMMENT ON COLUMN estimate.item_rates.created_by IS 'User who created this rate';