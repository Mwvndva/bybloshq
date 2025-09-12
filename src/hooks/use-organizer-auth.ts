import { useContext } from 'react';
import { OrganizerAuthContext } from '@/contexts/OrganizerAuthContext';

export const useOrganizerAuth = () => {
  const context = useContext(OrganizerAuthContext);
  
  if (!context) {
    throw new Error('useOrganizerAuth must be used within an OrganizerAuthProvider');
  }
  
  return context;
};
