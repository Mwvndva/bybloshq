import { useMutation } from '@tanstack/react-query';
import creatorApi from '@/features/creator/api';

export function useTrackCreatorLinkMutation() {
  return useMutation({
    mutationFn: (code: string) => creatorApi.trackLinkClick(code),
  });
}


