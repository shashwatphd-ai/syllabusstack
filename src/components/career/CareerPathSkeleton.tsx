import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * CareerPathSkeleton - Loading skeleton for the Career Path page
 *
 * Shows placeholder content while career data, gap analysis,
 * and recommendations are being fetched.
 */
export function CareerPathSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Main content area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Dream Jobs */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <DreamJobCardSkeleton key={i} />
              ))}
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Gap Analysis */}
        <div className="lg:col-span-2 space-y-4">
          {/* Match Score Card */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-10 w-20 ml-auto" />
                  <Skeleton className="h-3 w-24 ml-auto" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mt-4" />
            </CardContent>
          </Card>

          {/* Gap Analysis Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <GapCardSkeleton title="Critical Gaps" count={3} />
            <GapCardSkeleton title="Priority Gaps" count={4} />
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <RecommendationSkeleton key={i} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Dream job card skeleton
 */
function DreamJobCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

/**
 * Gap analysis card skeleton
 */
function GapCardSkeleton({ title, count }: { title: string; count: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="h-4 w-4 mt-0.5" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Recommendation item skeleton
 */
function RecommendationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg">
      <Skeleton className="h-5 w-5 mt-0.5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

export { DreamJobCardSkeleton, GapCardSkeleton, RecommendationSkeleton };
