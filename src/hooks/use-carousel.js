import * as React from "react";

import { CarouselContext } from "@/components/ui/carousel";

export function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}
