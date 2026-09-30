import type { Setting, SettingGroup } from '@/lib/api/types';

export const GROUPS: { key: SettingGroup; title: string; description: string }[] = [
  { key: 'patrol', title: 'Patroli', description: 'Aturan saat petugas memindai titik patroli.' },
  { key: 'face', title: 'Validasi Wajah', description: 'Pencocokan wajah saat scan dan pemeriksaan foto wajah referensi pengguna.' },
  { key: 'security', title: 'Keamanan & Sesi', description: 'Penguncian akun dan masa berlaku login.' },
];

/** Indonesian labels; unknown keys fall back to the server's (English) description. */
const META: Record<string, { label: string; description: string }> = {
  patrol_location_radius_meters: {
    label: 'Radius lokasi scan',
    description: 'Jarak maksimal HP ke titik patroli yang mewajibkan validasi lokasi. Juga ditampilkan sebagai lingkaran di peta.',
  },
  patrol_max_offline_hours: {
    label: 'Batas scan offline',
    description: 'Umur scan offline paling lama yang masih diterima saat HP tersambung kembali.',
  },
  face_mobile_accuracy: {
    label: 'Akurasi wajah di aplikasi',
    description: 'Skor kecocokan wajah (0–1) yang dibutuhkan aplikasi mobile untuk menyatakan wajah cocok.',
  },
  face_match_min_score: {
    label: 'Skor wajah minimum di server',
    description: 'Skor minimum yang diperiksa server saat scan. 0 = nonaktif (server hanya memeriksa status wajah terverifikasi).',
  },
  face_photo_validation: {
    label: 'Periksa foto wajah referensi',
    description: 'Saat pengguna dibuat atau fotonya diganti, foto harus berisi tepat satu wajah yang menghadap kamera.',
  },
  face_min_size_ratio: {
    label: 'Ukuran wajah minimum',
    description: 'Lebar wajah minimum dibanding sisi terpendek foto referensi (0,2 = 20%).',
  },
  face_max_tilt_degrees: {
    label: 'Kemiringan kepala maksimum',
    description: 'Batas kepala miring ke kiri/kanan pada foto referensi.',
  },
  face_max_turn_ratio: {
    label: 'Toleh kepala maksimum',
    description: 'Batas kepala menoleh ke samping pada foto referensi. Makin kecil makin ketat.',
  },
  login_max_failed_attempts: {
    label: 'Batas salah password',
    description: 'Jumlah salah password berturut-turut sebelum akun dikunci.',
  },
  login_lock_minutes: {
    label: 'Lama akun terkunci',
    description: 'Berapa lama akun dikunci setelah terlalu banyak salah password.',
  },
  access_token_ttl_minutes: {
    label: 'Masa berlaku access token',
    description: 'Token diperpanjang otomatis selama pengguna masih login; nilai kecil membuat perpanjangan lebih sering.',
  },
  refresh_token_ttl_days: {
    label: 'Tetap login selama',
    description: 'Berapa lama pengguna tetap login tanpa memasukkan password lagi.',
  },
};

const UNITS: Record<string, string> = {
  meters: 'm',
  hours: 'jam',
  minutes: 'menit',
  days: 'hari',
  degrees: '°',
  attempts: 'kali',
};

export function settingLabel(setting: Setting): string {
  return META[setting.key]?.label ?? setting.key;
}

export function settingDescription(setting: Setting): string {
  return META[setting.key]?.description ?? setting.description;
}

export function unitLabel(unit: string): string {
  return UNITS[unit] ?? unit;
}

export function formatSettingValue(setting: Setting, value = setting.value): string {
  if (typeof value === 'boolean') return value ? 'Aktif' : 'Nonaktif';
  const unit = unitLabel(setting.unit);
  const text = value.toLocaleString('id-ID', { maximumFractionDigits: 4 });
  return unit ? `${text}${unit === '°' ? '' : ' '}${unit}` : text;
}

/** Client-side check with the same bounds the server enforces. */
export function validateSetting(setting: Setting, value: unknown): string | null {
  if (setting.type === 'boolean') return typeof value === 'boolean' ? null : 'Pilih aktif atau nonaktif.';
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Wajib diisi.';
  if (setting.type === 'integer' && !Number.isInteger(value)) return 'Harus bilangan bulat.';
  if (setting.min !== null && value < setting.min) return `Minimal ${setting.min.toLocaleString('id-ID')}.`;
  if (setting.max !== null && value > setting.max) return `Maksimal ${setting.max.toLocaleString('id-ID')}.`;
  return null;
}
