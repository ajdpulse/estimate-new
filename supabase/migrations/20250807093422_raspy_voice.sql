/*
  # Create Estimate Schema and Works Table

  1. New Schema
    - `estimate` schema for all estimate-related tables

  2. New Tables
    - `works`
      - `sr_no` (serial, primary key)
      - `type` (text, TS or AA)
      - `works_id` (text, auto-generated format: YYYY-TYPE-XXX)
      - `ssr` (text)
      - `work_name` (text, required)
      - `division` (text)
      - `sub_division` (text)
      - `fund_head` (text)
      - `major_head` (text)
      - `minor_head` (text)
      - `service_head` (text)
      - `departmental_head` (text)
      - `sanctioning_authority` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid, references auth.users)

  3. Security
    - Enable RLS on `works` table
    - Add policies for authenticated users
*/

-- Create estimate schema
CREATE SCHEMA IF NOT EXISTS estimate;

-- Create sequence for works numbering
CREATE SEQUENCE IF NOT EXISTS estimate.works_counter_seq START 111;

-- Function to generate works_id
CREATE OR REPLACE FUNCTION estimate.generate_works_id(work_type TEXT)
RETURNS TEXT AS $$
DECLARE
    current_year TEXT;
    counter_val INTEGER;
    type_code TEXT;
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Validate and set type code
    IF work_type = 'Technical Sanction' THEN
        type_code := 'TS';
    ELSIF work_type = 'Administrative Approval' THEN
        type_code := 'AA';
    ELSE
        RAISE EXCEPTION 'Invalid work type. Must be "Technical Sanction" or "Administrative Approval"';
    END IF;
    
    -- Get next counter value
    counter_val := nextval('estimate.works_counter_seq');
    
    -- Format: YYYY-TYPE-XXX
    RETURN current_year || '-' || type_code || '-' || LPAD(counter_val::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Create works table
CREATE TABLE IF NOT EXISTS estimate.works (
    sr_no SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('Technical Sanction', 'Administrative Approval')),
    works_id TEXT UNIQUE NOT NULL,
    ssr TEXT,
    work_name TEXT NOT NULL,
    division TEXT,
    sub_division TEXT,
    fund_head TEXT,
    major_head TEXT,
    minor_head TEXT,
    service_head TEXT,
    departmental_head TEXT,
    sanctioning_authority TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create trigger to auto-generate works_id
CREATE OR REPLACE FUNCTION estimate.set_works_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.works_id IS NULL OR NEW.works_id = '' THEN
        NEW.works_id := estimate.generate_works_id(NEW.type);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_works_id
    BEFORE INSERT ON estimate.works
    FOR EACH ROW
    EXECUTE FUNCTION estimate.set_works_id();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION estimate.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_works_updated_at
    BEFORE UPDATE ON estimate.works
    FOR EACH ROW
    EXECUTE FUNCTION estimate.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE estimate.works ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all works"
    ON estimate.works
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert works"
    ON estimate.works
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own works"
    ON estimate.works
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own works"
    ON estimate.works
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_works_type ON estimate.works(type);
CREATE INDEX IF NOT EXISTS idx_works_works_id ON estimate.works(works_id);
CREATE INDEX IF NOT EXISTS idx_works_created_by ON estimate.works(created_by);
CREATE INDEX IF NOT EXISTS idx_works_created_at ON estimate.works(created_at);

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA estimate TO authenticated;
GRANT ALL ON estimate.works TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE estimate.works_counter_seq TO authenticated;