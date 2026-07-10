import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function OrdersLoadingState() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="border-stone-200 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
              <div className="space-y-3 sm:space-y-4 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-2" />
                    <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 sm:w-24 self-start sm:self-auto" />
                </div>
                <div>
                  <Skeleton className="h-4 sm:h-5 w-16 sm:w-20 mb-2" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 sm:h-10 w-full rounded-lg" />
                    <Skeleton className="h-8 sm:h-10 w-3/4 rounded-lg" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-0 lg:space-y-3 lg:min-w-[200px]">
                <div className="flex-1 sm:flex-none">
                  <Skeleton className="h-6 sm:h-7 w-24 sm:w-32 mb-1" />
                  <Skeleton className="h-3 w-16 sm:w-20" />
                </div>
                <div className="w-full sm:w-auto lg:w-full space-y-2">
                  <Skeleton className="h-8 sm:h-9 w-full rounded-md" />
                  <Skeleton className="h-8 sm:h-9 w-full rounded-md" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


