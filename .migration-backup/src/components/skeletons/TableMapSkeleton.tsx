import { Skeleton } from "@/components/ui/skeleton";

const TableMapSkeleton = () => (
  <div className="p-4 md:p-6 space-y-4">
    {/* Header skeleton */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
    </div>
    {/* Filter chips */}
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
      ))}
    </div>
    {/* Table grid */}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  </div>
);

export default TableMapSkeleton;
