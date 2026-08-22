/**
 * App router suspense fallback delegating to shared LoadingScreen primitive.
 */
import { LoadingScreen } from '@/shared/components/LoadingScreen';

export interface RouteFallbackProps {
    message?: string;
}

export function RouteFallback({ message = 'Loading' }: RouteFallbackProps) {
    return <LoadingScreen message={message} />;
}

export default RouteFallback;
