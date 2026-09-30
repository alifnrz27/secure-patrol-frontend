// Types mirror docs/openapi.yaml of the backend.

export interface ApiMeta {
  message: string;
  code: number;
  status: string;
}

export interface Envelope<T> {
  meta: ApiMeta;
  data: T;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export type RoleCode = 'super_admin' | 'security_manager' | 'security_admin' | 'security_head' | 'security_team';

export interface AppConfig {
  server_time: string;
  timezone: string;
  request_timestamp_tolerance_seconds: number;
  location_radius_meters: number;
  face_match_min_score: number | null;
  max_offline_hours: number;
  max_scan_photos: number;
  max_photo_size_bytes: number;
}

export interface RoleSummary {
  id: number;
  code: string;
  name: string;
}

export interface UnitSummary {
  id: number;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export interface Unit extends UnitSummary {
  users_count: number;
  patrol_points_count: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: RoleSummary;
  /** null for head office users (Super-Admin, Manager Keamanan) */
  unit_id: number | null;
  unit: UnitSummary | null;
  is_active: boolean;
  is_locked: boolean;
  face_photo_url: string | null;
  face_photo_updated_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginUser extends User {
  face_photo_base64: string | null;
  face_photo_mime_type: 'image/jpeg' | 'image/png' | null;
}

export interface TokenResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  user: LoginUser;
  config: AppConfig;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Platform = 'android' | 'ios' | 'web' | 'server';

export interface AppClient {
  id: number;
  name: string;
  platform: Platform;
  app_id: string;
  key_hint: string;
  description: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  key_rotated_at: string | null;
  previous_key_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppClientCredential extends AppClient {
  app_key: string;
  warning?: string;
}

export interface PatrolPoint {
  id: number;
  unit_id: number;
  name: string;
  location: string;
  nfc_code: string;
  latitude: number;
  longitude: number;
  is_location_match_required: boolean;
  is_face_validation_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatrolShift {
  id: number;
  unit_id: number;
  name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  crosses_midnight: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GroupStatus = 'upcoming' | 'ongoing' | 'finished';
export type ScanCondition = 'normal' | 'abnormal';

export interface GroupProgress {
  total_points: number;
  scanned_points: number;
  unscanned_points: number;
  total_scans: number;
  abnormal_scans: number;
}

export interface PatrolGroup {
  id: number;
  unit: { id: number; code: string; name: string };
  shift: { id: number; name: string };
  shift_date: string;
  start_at: string;
  end_at: string;
  status: GroupStatus;
  progress: GroupProgress;
  created_at: string;
}

export interface PatrolGroupSummary {
  id: number;
  unit_id: number;
  unit_name: string;
  shift_id: number;
  shift_name: string;
  shift_date: string;
  start_at: string;
  end_at: string;
}

export interface PatrolUserSummary {
  id: number;
  name: string;
  email: string;
}

export interface PatrolListItem {
  id: number;
  group?: PatrolGroupSummary;
  patrol_point_id: number;
  name: string;
  location: string;
  nfc_code: string;
  latitude: number;
  longitude: number;
  is_location_match_required: boolean;
  is_face_validation_required: boolean;
  is_scanned: boolean;
  scan_count: number;
  last_scanned_at: string | null;
  last_scanned_by: PatrolUserSummary | null;
  last_condition: ScanCondition | null;
}

export interface PatrolGroupDetail extends PatrolGroup {
  items: PatrolListItem[];
}

export interface PatrolScan {
  id: number;
  client_scan_id: string;
  group: PatrolGroupSummary;
  patrol_point: {
    patrol_list_item_id: number;
    patrol_point_id: number;
    name: string;
    location: string;
    nfc_code: string;
  };
  condition: ScanCondition;
  note: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  is_location_valid: boolean;
  is_face_verified: boolean;
  face_match_score: number | null;
  scanned_at: string;
  received_at: string;
  scanned_by: PatrolUserSummary;
  photos: { id: number; url: string }[];
}

export type HelpDeskCategory = 'rule' | 'guide' | 'faq';

export interface HelpDeskArticle {
  id: number;
  category: HelpDeskCategory;
  title: string;
  content: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: number;
  action: AuditAction;
  resource: string;
  resource_id: string | null;
  endpoint: string;
  method: string;
  path: string;
  status_code: number;
  /** null for actions from the backend CLI */
  user: { id: number; name: string; email: string; role_code: string } | null;
  app_platform: string;
  ip_address: string;
  user_agent: string;
  source: 'api' | 'cli';
  /** Unit of the user who made the change; null for head office and CLI */
  unit_id: number | null;
  created_at: string;
}

export type SettingGroup = 'patrol' | 'face' | 'security';
export type SettingValue = number | boolean;

export interface Setting {
  key: string;
  /** Level of the list: global values, or the values of one unit */
  level: 'global' | 'unit';
  /** Head office value the unit follows unless it sets its own */
  global_value: SettingValue;
  /** Unit has no own value and follows the head office (always false on the global level) */
  is_inherited: boolean;
  group: SettingGroup;
  type: 'integer' | 'number' | 'boolean';
  value: SettingValue;
  default_value: SettingValue;
  is_default: boolean;
  min: number | null;
  max: number | null;
  unit: string;
  description: string;
  updated_by: number | null;
  updated_at: string | null;
}
