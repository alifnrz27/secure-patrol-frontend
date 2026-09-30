import { apiOrigin } from '@/config/env';

export type ApiErrorKind =
  | 'network'
  | 'app'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'bad_request'
  | 'too_large'
  | 'locked'
  | 'server';

/** 403 on any request once a unit is deactivated (login, refresh, or a token already in use). */
export const UNIT_INACTIVE = 'your unit is inactive, contact the head office';
/** 403 for a role that may not use this platform (e.g. Tim Keamanan on the web). */
export const PLATFORM_NOT_ALLOWED = 'your role is not allowed to sign in on this platform';

export const APP_AUTH_ERRORS = {
  timestamp: 'request timestamp is invalid or outside the allowed window',
  nonceInvalid: 'request nonce is invalid',
  nonceReused: 'request nonce has already been used',
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  /** meta.message from the server (English), or a short description for network errors */
  readonly serverMessage: string;
  /** Raw `data` of the error envelope */
  readonly data: unknown;

  constructor(status: number, serverMessage: string, data: unknown) {
    super(serverMessage);
    this.name = 'ApiError';
    this.status = status;
    this.serverMessage = serverMessage;
    this.data = data;
    this.kind = kindFromStatus(status, serverMessage);
  }

  /** Validation messages (`data` array) or the single detail string. */
  get details(): string[] {
    if (Array.isArray(this.data)) return this.data.filter((d): d is string => typeof d === 'string');
    if (typeof this.data === 'string' && this.data) return [this.data];
    return [];
  }

  /** The most specific message the server gave: detail string if present, otherwise meta.message. */
  get detailOrMessage(): string {
    return typeof this.data === 'string' && this.data ? this.data : this.serverMessage;
  }

  /** True when any server message (meta.message or data) contains the text. */
  mentions(text: string): boolean {
    const lower = text.toLowerCase();
    return [this.serverMessage, ...this.details].some((m) => m.toLowerCase().includes(lower));
  }
}

function kindFromStatus(status: number, message: string): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 401) return message === 'Unauthorized app' ? 'app' : 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 413) return 'too_large';
  if (status === 422) return 'validation';
  if (status === 429) return 'locked';
  if (status >= 500) return 'server';
  return 'bad_request';
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// Indonesian texts for server messages the UI shows directly. Unknown messages
// fall back to the server text so nothing is hidden from the user.
const SERVER_MESSAGES_ID: Record<string, string> = {
  'email or password is incorrect': 'Email atau password salah.',
  'account is inactive': 'Akun Anda tidak aktif. Hubungi admin.',
  'account is temporarily locked because of too many failed login attempts':
    'Akun terkunci sementara karena terlalu banyak percobaan login gagal.',
  'there is no active patrol shift at the scan time': 'Tidak ada shift aktif saat ini.',
  'email is already registered': 'Email sudah terdaftar.',
  // NFC codes are unique across every unit.
  'nfc code is already used by another patrol point': 'Kode NFC sudah dipakai (bisa di unit lain).',
  'role code is already used': 'Kode role sudah dipakai.',
  'face photo is required': 'Foto wajah wajib diunggah.',
  'role not found or inactive': 'Role tidak ditemukan atau tidak aktif.',
  'file size must not exceed 5 MB': 'Ukuran file maksimal 5 MB.',
  'file must be a JPEG or PNG image': 'File harus berupa gambar JPEG atau PNG.',
  // Also returned when moving your own account to another unit.
  'you cannot delete, deactivate or change the role of your own account':
    'Anda tidak bisa menghapus, menonaktifkan, mengganti role, atau memindahkan unit akun sendiri.',
  'you are not allowed to manage users with this role': 'Anda tidak diizinkan mengelola user dengan role ini.',
  'system role cannot be deleted or deactivated': 'Role sistem tidak bisa dihapus atau dinonaktifkan.',
  'role is still assigned to users': 'Role masih dipakai oleh user.',
  'old password is incorrect': 'Password lama salah.',
  'new password must be different from the old password': 'Password baru harus berbeda dari password lama.',
  'article_ids must contain every article of the category exactly once':
    'Urutan harus memuat semua artikel kategori ini tepat satu kali.',
  'This feature is only available on the web platform': 'Fitur ini hanya tersedia untuk platform web.',
  'this role is not allowed to use the web admin': 'Akun Anda tidak memiliki akses ke web admin. Gunakan aplikasi mobile.',
  'your role is not allowed to sign in on this platform': 'Akun Anda tidak memiliki akses ke web admin. Gunakan aplikasi mobile.',
  'your unit is inactive, contact the head office': 'Unit Anda sedang dinonaktifkan, hubungi pusat.',
  'You do not have access to this resource': 'Role Anda tidak diizinkan melakukan aksi ini.',
  'unit code is already used by another unit': 'Kode unit sudah dipakai unit lain.',
  'unit still has users or patrol points, move or delete them first':
    'Unit masih memiliki pengguna atau titik patroli. Pindahkan atau hapus datanya dulu, atau nonaktifkan unit ini.',
  'unit_id is required for this role': 'Unit wajib dipilih untuk role ini.',
  'unit not found': 'Unit tidak ditemukan.',
  'patrol points are managed by each unit': 'Titik patroli dikelola oleh masing-masing unit.',
  'shifts are managed by each unit': 'Shift dikelola oleh masing-masing unit.',
  'password must be 8-72 characters and contain at least one letter and one digit': 'Password harus 8–72 karakter dan mengandung huruf serta angka.',
  'face photo could not be read as an image': 'Foto wajah tidak bisa dibaca sebagai gambar.',
  'no face detected in the photo, use a clear and well lit photo of the face': 'Tidak ada wajah terdeteksi. Gunakan foto wajah yang jelas dan terang.',
  'the photo must contain exactly one face': 'Foto harus berisi tepat satu wajah.',
  'the face is too small, take the photo closer so the face fills more of the picture': 'Wajah terlalu kecil. Ambil foto lebih dekat agar wajah memenuhi foto.',
  'the face must look straight at the camera with both eyes visible': 'Wajah harus menghadap lurus ke kamera dengan kedua mata terlihat.',
};

export function translateServerMessage(message: string): string {
  if (SERVER_MESSAGES_ID[message]) return SERVER_MESSAGES_ID[message];
  const overlap = /^patrol shift overlaps with another active shift: (.+)$/.exec(message);
  if (overlap) return `Jam shift tumpang tindih dengan shift aktif lain: ${overlap[1]}.`;
  const range = /^must be between (\S+) and (\S+)$/.exec(message);
  if (range) return `Harus antara ${range[1]} dan ${range[2]}.`;
  if (message === 'unknown setting') return 'Setting tidak dikenal.';
  const exportLimit = /^export is limited to (\d+) rows/.exec(message);
  if (exportLimit) return `Ekspor maksimal ${Number(exportLimit[1]).toLocaleString('id-ID')} baris. Persempit filter, misalnya rentang tanggal.`;
  return message;
}

/** A user-facing Indonesian message for any error. */
export function describeError(error: unknown): string {
  if (!isApiError(error)) return 'Terjadi gangguan, coba lagi.';
  switch (error.kind) {
    case 'network':
      // Name the server so a wrong or unreachable API address is visible without DevTools.
      return `Tidak bisa terhubung ke server API (${apiOrigin()}). Periksa koneksi dan pastikan server berjalan, lalu coba lagi.`;
    case 'server':
      return 'Terjadi gangguan di server, coba lagi.';
    case 'app':
      return 'Konfigurasi aplikasi tidak valid. Hubungi admin sistem.';
    case 'unauthorized': {
      // Login answers 401 with a specific reason (e.g. wrong password).
      const translated = translateServerMessage(error.detailOrMessage);
      return translated !== error.detailOrMessage ? translated : 'Sesi berakhir, silakan login kembali.';
    }
    case 'forbidden': {
      const detail = error.detailOrMessage;
      if (!detail || detail === 'Forbidden') return 'Anda tidak memiliki akses.';
      const translated = translateServerMessage(detail);
      return translated !== detail ? translated : `Anda tidak memiliki akses. ${detail}`;
    }
    case 'not_found':
      return 'Data tidak ditemukan.';
    case 'too_large':
      return 'Ukuran data terlalu besar (maksimal 20 MB).';
    case 'locked': {
      // 429 carries { locked_until, retry_after_seconds }.
      const retry = (error.data as { retry_after_seconds?: number } | null)?.retry_after_seconds;
      if (typeof retry === 'number' && retry > 0) {
        const minutes = Math.ceil(retry / 60);
        return `Akun terkunci karena terlalu banyak salah password. Coba lagi dalam ${minutes} menit.`;
      }
      return translateServerMessage(error.detailOrMessage);
    }
    default: {
      const details = error.details;
      if (details.length > 1) return details.map(translateServerMessage).join(' ');
      return translateServerMessage(error.detailOrMessage);
    }
  }
}
