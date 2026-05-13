import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { UserRecipe, UserRecipeCreate } from '@groceryhack/shared/types';

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

export function useUserRecipes() {
  return useQuery<{ recipes: UserRecipe[] }>({
    queryKey: ['recipes'],
    queryFn: () => api.get<{ recipes: UserRecipe[] }>('/recipes'),
    refetchInterval: 1000,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserRecipeCreate) =>
      api.post<UserRecipe>('/recipes', transformKeysToSnake(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserRecipeCreate }) =>
      api.patch<UserRecipe>(`/recipes/${id}`, transformKeysToSnake(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
