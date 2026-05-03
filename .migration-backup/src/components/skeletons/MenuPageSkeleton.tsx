import { Skeleton } from "@/components/ui/skeleton";

const MenuPageSkeleton = () => (
  <div className="p-4 md:p-6 space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-28 rounded-xl" />
    </div>
    {/* Search bar */}
    <Skeleton className="h-10 w-full rounded-xl" />
    {/* Category tabs */}
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
      ))}
    </div>
    {/* Menu grid */}
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  </div>
);

export default MenuPageSkeleton;
