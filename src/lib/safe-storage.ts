const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return memoryStorage.get(name) ?? null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      memoryStorage.set(name, value);
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      memoryStorage.delete(name);
    }
  },
};
