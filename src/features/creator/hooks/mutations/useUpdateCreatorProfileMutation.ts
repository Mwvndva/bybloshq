import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile, type UpdateCreatorProfilePayload } from '../../api/profile';
import { creatorQueryKeys } from '../../api/queryKeys';

export function useUpdateCreatorProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateCreatorProfilePayload) => updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorQueryKeys.all });
    },
  });
}
