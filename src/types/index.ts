export interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface UserRole {
  id: string;
  user_id: string;
  role_name: string;
  application_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationPermission {
  id: string;
  role_name: string;
  application_id: string;
  permission_name: string;
  created_at: string;
}

export interface EstimateWork {
  id: string;
  title: string;
  description: string;
  estimated_amount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Work {
  sr_no: number;
  type: 'Technical Sanction' | 'Administrative Approval';
  works_id: string;
  ssr?: string;
  work_name: string;
  division?: string;
  sub_division?: string;
  fund_head?: string;
  major_head?: string;
  minor_head?: string;
  service_head?: string;
  departmental_head?: string;
  sanctioning_authority?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  total_estimated_cost: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  recap_json?: any;
  village?: string;
}

export interface SubWork {
  sr_no: number;
  works_id: string;
  subworks_id: string;
  subworks_name: string;
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface SubworkItem {
  id: string;
  subwork_id: string;
  item_number: string;
  category?: string;
  description_of_item: string;
  ssr_quantity: number;
  ssr_rate: number;
  ssr_unit?: string;
  total_item_amount: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ItemMeasurement {
  sr_no: number;
  subwork_item_id: number;
  work_id: string;
  subwork_id: string;
  item_id: string;
  description_of_items?: string;
  no_of_units: number;
  length: number;
  width_breadth: number;
  height_depth: number;
  calculated_quantity: number;
  estimated_quantity: number;
  actual_quantity: number;
  variance: number;
  variance_reason?: string;
  unit?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemLead {
  sr_no: number;
  subwork_item_sr_no: number;
  material: string;
  location_of_quarry?: string;
  lead_in_km: number;
  lead_charges: number;
  initial_lead_charges: number;
  net_lead_charges: number;
  created_at: string;
  updated_at: string;
}

export interface ItemMaterial {
  sr_no: number;
  subwork_item_sr_no: number;
  material_name: string;
  required_quantity: number;
  unit?: string;
  rate_per_unit: number;
  total_material_cost: number;
  created_at: string;
  updated_at: string;
}

export interface ItemRate {
  sr_no: number;
  subwork_item_sr_no: number;
  description: string;
  rate: number;
  unit?: string;
  document_reference?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface EstimateSubWork {
  id: string;
  work_id: string;
  title: string;
  description: string;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface EstimateTemplate {
  id: string;
  template_name: string;
  description?: string;
  original_works_id: string;
  template_data: {
    work: Work;
    subworks: SubWork[];
    subworkItems: { [subworkId: string]: SubworkItem[] };
    measurements: { [itemId: string]: ItemMeasurement[] };
    leads: { [itemId: string]: ItemLead[] };
    materials: { [itemId: string]: ItemMaterial[] };
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => void;
  t: (key: string) => string;
}

export interface TaxEntry {
  id: string;
  name: string;
  percentage: number;
  applyTo: 'part_a' | 'part_b' | 'both';
}

export interface RecapCalculations {
  partA: {
    subtotal: number;
    taxes: { [taxId: string]: number };
    total: number;
  };
  partB: {
    subtotal: number;
    taxes: { [taxId: string]: number };
    total: number;
  };
  additionalCharges: {
    contingencies: number;
    inspectionCharges: number;
    dprCharges: number;
  };
  grandTotal: number;
}