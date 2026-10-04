/** Web preview: the browser's own dialog (react-native-web has no Alert). */
export async function confirm(title: string, message: string, _ok: string, _cancel: string): Promise<boolean> {
  return window.confirm(`${title}\n\n${message}`);
}
