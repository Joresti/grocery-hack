import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  ImportantItem,
  AddImportantItemRequest,
  UpdateImportantItemRequest,
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

export function useImportantItems() {
  return useQuery<ImportantItem[]>({
    queryKey: ['important-items'],
    queryFn: async () => {
      const res = await api.get<{ items: ImportantItem[] }>('/important-items');
      return res.items;
    },
  });
}

export function useAddImportantItem() {
  const queryClient = useQueryClient();
  return useMutation<ImportantItem, Error, AddImportantItemRequest>({
    mutationFn: (item: AddImportantItemRequest) =>
      api.post<ImportantItem>('/important-items', transformKeysToSnake(item)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['important-items'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}

export function useUpdateImportantItem() {
  const queryClient = useQueryClient();
  return useMutation<ImportantItem, Error, { id: string; data: UpdateImportantItemRequest }>({
    mutationFn: ({ id, data }) =>
      api.patch<ImportantItem>(`/important-items/${id}`, transformKeysToSnake(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['important-items'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
