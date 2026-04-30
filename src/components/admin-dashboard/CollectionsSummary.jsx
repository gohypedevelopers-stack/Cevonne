import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function CollectionsSummary({ collections, loading }) {
  if (loading) {
    return (
      <Card className="border-none bg-muted/40">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Collections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalProducts = collections.reduce(
    (acc, collection) => acc + (collection._count?.products ?? 0),
    0
  );

  return (
    <Card className="border-none bg-muted/40">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Collections</CardTitle>
        <CardDescription>Product distribution across active collections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {collections.slice(0, 5).map((collection) => {
          const productCount = collection._count?.products ?? 0;
          const percentage = totalProducts
            ? Math.round((productCount / totalProducts) * 100)
            : 0;
          return (
            <div key={collection.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{collection.name}</span>
                <span className="text-muted-foreground">{productCount} products</span>
              </div>
              <Progress value={percentage} />
            </div>
          );
        })}
        {collections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Create a collection to organise your catalogue.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
