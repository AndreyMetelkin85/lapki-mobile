import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { apiUrl } from './api';
import { ApiError } from './errors';
import type { OperationStore } from './operations';

/** Создаёт хранилище метаданных, изолированное по серверу и пользователю. */
export function operationStore<S extends z.ZodTypeAny>(
  name: string,
  userId: string,
  schema: S,
  server = apiUrl(),
): OperationStore<z.output<S>> {
  const key = `lapki.${server}.${userId}.${name}`;
  return {
    read: async () => {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      try {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        /* Повреждённое состояние не используется для серверной операции. */
      }
      throw new ApiError('STORAGE_UNAVAILABLE');
    },
    write: async (value) => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      } catch {
        throw new ApiError('STORAGE_UNAVAILABLE');
      }
    },
    clear: async () => {
      await AsyncStorage.removeItem(key);
    },
  };
}
