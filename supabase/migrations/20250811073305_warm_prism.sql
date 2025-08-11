@@ .. @@
 -- Add foreign key constraint
-ALTER TABLE estimate.item_rates 
-ADD CONSTRAINT item_rates_subwork_item_id_fkey 
-FOREIGN KEY (subwork_item_id) 
-REFERENCES estimate.subwork_items(id) 
-ON DELETE CASCADE;
+-- First, we need to add both subwork_id and item_number to the item_rates table
+ALTER TABLE estimate.item_rates 
+ADD COLUMN subwork_id text NOT NULL,
+ADD COLUMN item_number text NOT NULL;
+
+-- Remove the old subwork_item_id column since we're using composite key
+ALTER TABLE estimate.item_rates 
+DROP COLUMN subwork_item_id;
+
+-- Add foreign key constraint using composite key
+ALTER TABLE estimate.item_rates 
+ADD CONSTRAINT item_rates_subwork_item_fkey 
+FOREIGN KEY (subwork_id, item_number) 
+REFERENCES estimate.subwork_items(subwork_id, item_number) 
+ON DELETE CASCADE;