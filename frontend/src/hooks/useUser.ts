import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { User, UpdateUserRequest } from '@groceryhack/shared/types';
import { useAuth } from './useAuth';

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformKeysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [camelToSnake(key), value])
  );
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: (data: UpdateUserRequest) =>
      api.patch<User>('/users/me', transformKeysToSnake(data as Record<string, unknown>)),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
