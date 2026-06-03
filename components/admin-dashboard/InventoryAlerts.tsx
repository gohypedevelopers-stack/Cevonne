import { AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function InventoryAlerts({ items, loading }) {
  return (
    <Card className="border-none bg-muted/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">Low inventory</CardTitle>
          <CardDescription>Shades and products below the stock threshold.</CardDescription>
        </div>
        <AlertTriangle className="h-6 w-6 text-amber-500" />
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Inventory levels are healthy. No action required.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Shade</TableHead>
                <TableHead className="hidden sm:table-cell">Threshold</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{entry.product?.name ?? "Unassigned"}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.product?.slug ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {entry.shade?.name ?? "All shades"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {entry.lowStockThreshold}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{entry.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
