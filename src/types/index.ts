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
  id: string;
  subwork_item_id: string;
  sr_no: number;
  ssr_reference?: string;
  works_number?: string;
  sub_works_number?: string;
  description_of_items?: string;
  sub_description?: string;
  no_of_units: number;
  length: number;
  width_breadth: number;
  height_depth: number;
  calculated_quantity: number;
  unit?: string;
  line_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ItemLead {
  id: string;
  subwork_item_id: string;
  sr_no: number;
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
  id: string;
  subwork_item_id: string;
  material_name: string;
  required_quantity: number;
  unit?: string;
  rate_per_unit: number;
  total_material_cost: number;
  created_at: string;
  updated_at: string;
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