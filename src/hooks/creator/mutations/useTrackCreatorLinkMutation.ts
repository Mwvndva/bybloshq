import { useMutation } from '@tanstack/react-query';
import creatorApi from '@/api/creator';

export function useTrackCreatorLinkMutation() {
  return useMutation({
    mutationFn: (code: string) => creatorApi.trackLinkClick(code),
  });
}


