import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { OptimizeRequest, GroceryPlan } from '@groceryhack/shared/types';

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformKeysToSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(transformKeysToSnake);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        camelToSnake(key),
        transformKeysToSnake(value),
      ])
    );
  }
  return obj;
}

export function useOptimize() {
  const queryClient = useQueryClient();
  return useMutation<GroceryPlan, Error, OptimizeRequest>({
    mutationFn: (request: OptimizeRequest) =>
      api.post<GroceryPlan>('/optimize', transformKeysToSnake(request)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
