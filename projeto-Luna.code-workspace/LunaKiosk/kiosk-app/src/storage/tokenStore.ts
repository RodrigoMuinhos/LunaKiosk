import * as SecureStore from 'expo-secure-store';

// Pequena camada para persistir config/token no mobile e no web.
// No web, o SecureStore pode não existir; neste caso usamos localStorage.

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    const v = window.localStorage.getItem(key);
    return v && v.length ? v : null;
  }
  try {
    const v = await SecureStore.getItemAsync(key);
    return v && v.length ? v : null;
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (!value) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return;
  }
  try {
    if (!value) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // ignore
  }
}
