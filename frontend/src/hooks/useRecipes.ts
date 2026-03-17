import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { UserRecipe, UserRecipeCreate, RecipeStats } from '@groceryhack/shared/types';

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

export function useRecipes() {
  return useQuery<UserRecipe[]>({
    queryKey: ['recipes'],
    queryFn: async () => {
      const res = await api.get<{ recipes: UserRecipe[] }>('/recipes');
      return res.recipes;
    },
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation<UserRecipe, Error, UserRecipeCreate>({
    mutationFn: (recipe: UserRecipeCreate) =>
      api.post<UserRecipe>('/recipes', transformKeysToSnake(recipe)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation<UserRecipe, Error, { id: string; data: Partial<UserRecipeCreate> }>({
    mutationFn: ({ id, data }) =>
      api.patch<UserRecipe>(`/recipes/${id}`, transformKeysToSnake(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete<void>(`/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useRecipeStats(recipeId: string) {
  return useQuery<RecipeStats>({
    queryKey: ['recipeStats', recipeId],
    queryFn: () => api.get<RecipeStats>(`/recipes/${recipeId}/stats`),
    enabled: !!recipeId,
  });
}

export function usePublishRecipe() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.post<void>(`/recipes/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}
