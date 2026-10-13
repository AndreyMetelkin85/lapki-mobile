import { safeNativePath } from '../links';

/** Проверяет системные ссылки перед передачей Expo Router. */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  return safeNativePath(path);
}
