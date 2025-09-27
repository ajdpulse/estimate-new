/*
  # Create Measurement Book System

  1. New Tables
    - `measurement_book`
      - `sr_no` (serial, primary key)
      - `work_id` (text, foreign key to works.works_id)
      - `subwork_id` (text, reference to subworks)
      - `item_id` (text, reference to items)
      - `measurement_sr_no` (integer, measurement sequence number)
      - `description_of_items` (text, item description)
      - `no_of_units` (integer, number of units)
      - `length` (numeric, length measurement)
      - `width_breadth` (numeric, width/breadth measurement)
      - `height_depth` (numeric, height/depth measurement)
      - `estimated_quantity` (numeric, estimated quantity)
      - `actual_quantity` (numeric, actual measured quantity)
      - `variance` (numeric, difference between estimated and actual)
      - `variance_reason` (text, reason for variance)
      - `unit` (text, unit of measurement)
      - `measured_by` (text, person who measured)
      - `measured_at` (timestamp, when measurement was taken)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `measurement_book` table
    - Add policies for authenticated users to manage measurements

  3. Triggers
    - Auto-calculate actual_quantity from dimensions
    - Auto-calculate variance
    - Update timestamp trigger
*/

-- Create measurement_book table
CREATE TABLE IF NOT EXISTS estimate.measurement_book (
  sr_no serial NOT NULL,
  work_id text NOT NULL,
  subwork_id text NOT NULL,
  item_id text NOT NULL,
  measurement_sr_no integer NOT NULL DEFAULT 1,
  description_of_items text,
  no_of_units integer DEFAULT 1,
  length numeric(10, 3) DEFAULT 0,
  width_breadth numeric(10, 3) DEFAULT 0,
  height_depth numeric(10, 3) DEFAULT 0,
  estimated_quantity numeric(10, 3) DEFAULT 0,
  actual_quantity numeric(10, 3) DEFAULT 0,
  variance numeric(10, 3) DEFAULT 0,
  variance_reason text,
  unit text,
  measured_by text,
  measured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT measurement_book_pkey PRIMARY KEY (sr_no),
  CONSTRAINT fk_measurement_book_work_id 
    FOREIGN KEY (work_id) 
    REFERENCES estimate.works (works_id) 
    ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_measurement_book_work_id 
  ON estimate.measurement_book USING btree (work_id);

CREATE INDEX IF NOT EXISTS idx_measurement_book_subwork_id 
  ON estimate.measurement_book USING btree (subwork_id);

CREATE INDEX IF NOT EXISTS idx_measurement_book_item_id 
  ON estimate.measurement_book USING btree (item_id);

CREATE INDEX IF NOT EXISTS idx_measurement_book_measured_by 
  ON estimate.measurement_book USING btree (measured_by);

CREATE INDEX IF NOT EXISTS idx_measurement_book_measured_at 
  ON estimate.measurement_book USING btree (measured_at);

-- Enable RLS
ALTER TABLE estimate.measurement_book ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read measurement book entries"
  ON estimate.measurement_book
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert measurement book entries"
  ON estimate.measurement_book
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update measurement book entries"
  ON estimate.measurement_book
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete measurement book entries"
  ON estimate.measurement_book
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION estimate.update_measurement_book_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_measurement_book_updated_at_trigger
  BEFORE UPDATE ON estimate.measurement_book
  FOR EACH ROW
  EXECUTE FUNCTION estimate.update_measurement_book_updated_at();

-- Create function to auto-calculate quantities and variance
CREATE OR REPLACE FUNCTION estimate.calculate_measurement_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate actual_quantity based on dimensions
  NEW.actual_quantity = COALESCE(NEW.no_of_units, 1) * 
                       COALESCE(NEW.length, 0) * 
                       COALESCE(NEW.width_breadth, 1) * 
                       COALESCE(NEW.height_depth, 1);
  
  -- If width_breadth is 0, treat as linear measurement
  IF NEW.width_breadth = 0 THEN
    NEW.actual_quantity = COALESCE(NEW.no_of_units, 1) * COALESCE(NEW.length, 0);
  END IF;
  
  -- If both width_breadth and height_depth are 0, treat as count
  IF NEW.width_breadth = 0 AND NEW.height_depth = 0 THEN
    NEW.actual_quantity = COALESCE(NEW.no_of_units, 1);
  END IF;
  
  -- Calculate variance
  NEW.variance = NEW.actual_quantity - COALESCE(NEW.estimated_quantity, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-calculation
CREATE TRIGGER calculate_measurement_quantities_trigger
  BEFORE INSERT OR UPDATE ON estimate.measurement_book
  FOR EACH ROW
  EXECUTE FUNCTION estimate.calculate_measurement_quantities();