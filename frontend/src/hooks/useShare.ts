import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  ShareMealRequest,
  SharePlanRequest,
  ShareMealResponse,
  SharePlanResponse,
} from '@groceryhack/shared/types';

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

export function useShareMeal() {
  return useMutation<ShareMealResponse, Error, ShareMealRequest>({
    mutationFn: (request: ShareMealRequest) =>
      api.post<ShareMealResponse>('/share/meal', transformKeysToSnake(request)),
  });
}

export function useSharePlan() {
  return useMutation<SharePlanResponse, Error, SharePlanRequest>({
    mutationFn: (request: SharePlanRequest) =>
      api.post<SharePlanResponse>('/share/plan', transformKeysToSnake(request)),
  });
}
