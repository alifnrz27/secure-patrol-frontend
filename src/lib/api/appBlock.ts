// Set when the server answers "this app client exceeds the license limit": the
// web app's own App Client is over the license, so nothing works (login
// included) until an administrator fixes the license. Not a session problem.

let blocked = false;
const listeners = new Set<() => void>();

export const appBlock = {
  get: (): boolean => blocked,
  set(): void {
    if (blocked) return;
    blocked = true;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
