/*
  # Add Status and Total Estimated Cost columns to works table

  1. New Columns
    - `status` (text) - Work status with check constraint for valid values
    - `total_estimated_cost` (numeric) - Total estimated cost for the work
  
  2. Changes
    - Add status column with default value 'draft'
    - Add total_estimated_cost column with default value 0
    - Add check constraint for status values
    - Update existing records with default values

  3. Security
    - No RLS changes needed as table inherits existing policies
*/

-- Add status column with check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' AND table_name = 'works' AND column_name = 'status'
  ) THEN
    ALTER TABLE estimate.works ADD COLUMN status text DEFAULT 'draft';
    ALTER TABLE estimate.works ADD CONSTRAINT works_status_check 
      CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'in_progress', 'completed'));
  END IF;
END $$;

-- Add total_estimated_cost column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'estimate' AND table_name = 'works' AND column_name = 'total_estimated_cost'
  ) THEN
    ALTER TABLE estimate.works ADD COLUMN total_estimated_cost numeric(15,2) DEFAULT 0;
  END IF;
END $$;