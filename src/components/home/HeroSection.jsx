import React from "react";
import image from '@/assets/images/image.webp'


const HeroSection = ({
  label = "EXCLUSIVE PREORDER",
  title = "Cevonne Travels With Grace Coddington",
  ctaText = "Discover the Collection",
  ctaHref = "#",
}) => {
  return (
    <section className="relative isolate w-full overflow-hidden bg-black px-0">
      {/* Background image */}
      <div className="relative h-[60svh] min-h-[360px] w-full sm:h-[68svh] sm:min-h-[420px] md:h-[100vh]">
        <img
          src={image}
          alt="Campaign"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />

        {/* Subtle bottom gradient for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,0.55)_85%)]" />

        {/* Copy block */}
        <div className="absolute inset-x-0 bottom-10 mx-auto flex w-full max-w-[960px] flex-col items-center px-4 text-center text-white sm:bottom-12 sm:px-6 md:bottom-16 md:items-start md:text-left">
          {label ? (
            <p className="mb-3 text-[10px] tracking-[0.3em] text-white/80 sm:text-[11px] md:text-xs">
              {label}
            </p>
          ) : null}

          <h1 className="mb-4 max-w-3xl text-balance text-[22px] font-semibold leading-tight tracking-wide sm:text-[26px] md:mb-6 md:text-[34px] lg:text-[42px]">
            {title}
          </h1>

          <a
            href={ctaHref}
            className="rounded-full bg-white/95 px-6 py-3 text-[13px] font-medium text-neutral-900 transition hover:bg-white sm:text-[14px]"
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
