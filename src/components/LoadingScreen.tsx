import { RouteFallback } from './common/RouteFallback';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen = ({ message = 'Loading Byblos...' }: LoadingScreenProps) => {
    return <RouteFallback message={message} />;
};
