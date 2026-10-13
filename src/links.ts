/** Отклоняет повреждённые входящие URI до разбора маршрутизатором Android. */
export function safeNativePath(path: unknown): string {
  if (typeof path !== 'string' || !path || path.length > 4096) return '/';
  try {
    // Проверяем корректность percent-encoding, сохраняя исходное кодирование URL.
    decodeURIComponent(path);
    return path;
  } catch {
    return '/';
  }
}
