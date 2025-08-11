/*
  # Add deduction and manual quantity fields to item_measurements

  1. New Columns
    - `is_deduction` (boolean) - Whether this measurement is a deduction
    - `is_manual_quantity` (boolean) - Whether quantity was entered manually
    - `manual_quantity` (numeric) - Manual quantity value when not calculated from L×B×H
    - `unit` (text) - Unit of measurement (sqm, cum, nos, etc.)

  2. Changes
    - Add new columns to item_measurements table with appropriate defaults
    - All new columns are nullable to maintain compatibility with existing data
*/

-- Add new columns to item_measurements table
DO $$
BEGIN
  -- Add is_deduction column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_measurements' AND column_name = 'is_deduction'
  ) THEN
    ALTER TABLE item_measurements ADD COLUMN is_deduction boolean DEFAULT false;
  END IF;

  -- Add is_manual_quantity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_measurements' AND column_name = 'is_manual_quantity'
  ) THEN
    ALTER TABLE item_measurements ADD COLUMN is_manual_quantity boolean DEFAULT false;
  END IF;

  -- Add manual_quantity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_measurements' AND column_name = 'manual_quantity'
  ) THEN
    ALTER TABLE item_measurements ADD COLUMN manual_quantity numeric(10,3) DEFAULT 0;
  END IF;

  -- Add unit column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_measurements' AND column_name = 'unit'
  ) THEN
    ALTER TABLE item_measurements ADD COLUMN unit text;
  END IF;
END $$;