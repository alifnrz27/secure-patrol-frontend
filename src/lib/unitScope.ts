// Unit picked by a head office user in the header ("Semua unit" = null). Kept
// in localStorage only as a convenience; unit users never use it (the server
// scopes their data to their own unit and ignores unit_id).

const STORAGE_KEY = 'sp.unit_id';

function read(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

let selected: number | null = read();
const listeners = new Set<() => void>();

export const unitScope = {
  get: (): number | null => selected,
  set(unitId: number | null): void {
    if (unitId === selected) return;
    selected = unitId;
    try {
      if (unitId) localStorage.setItem(STORAGE_KEY, String(unitId));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
