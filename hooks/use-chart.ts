import * as React from "react";

import { ChartContext } from "@/components/ui/chart";

export function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}
