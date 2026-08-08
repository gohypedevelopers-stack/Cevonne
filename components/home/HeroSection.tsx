import React from "react";
import { STATIC_ASSETS } from "@/lib/assets";


const HeroSection = ({
  label = "WOMEN",
  title = "Fall-Winter 2026",
  ctaText = "Discover the Collection",
  ctaHref = "#",
}) => {
  return (
    <section className="relative isolate w-full overflow-hidden bg-black px-0">
      {/* Background image */}
      <div className="relative h-[60svh] min-h-[360px] w-full sm:h-[68svh] sm:min-h-[420px] md:h-[100vh]">
        <picture className="absolute inset-0 block h-full w-full">
          <source
            media="(min-width: 768px)"
            srcSet={STATIC_ASSETS.heroImageDesktop}
          />
          <img
            src={STATIC_ASSETS.heroImageMobile}
            alt="Campaign"
            className="h-full w-full object-cover"
            loading="eager"
          />
        </picture>

        {/* Copy block */}
        <div className="absolute inset-x-0 bottom-8 mx-auto flex w-full max-w-[960px] flex-col items-center px-4 text-center text-white sm:bottom-10 sm:px-6 md:bottom-12">
          {label ? (
            <p className="mb-2 text-[9px] font-normal tracking-[0.14em] text-white/90 sm:text-[10px]">
              {label}
            </p>
          ) : null}

          <h1 className="mb-3 max-w-3xl text-balance font-sans text-[22px] font-normal leading-none tracking-tight sm:text-[26px] md:mb-4 md:text-[34px]">
            {title}
          </h1>

          <a
            href={ctaHref}
            className="text-[12px] font-normal text-white underline decoration-1 underline-offset-8 transition-opacity hover:opacity-70 sm:text-[13px]"
            aria-label={ctaText}
          >
            {ctaText}
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
