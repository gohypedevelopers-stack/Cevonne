import { STATIC_ASSETS } from "@/lib/assets";

type HomeBannerProps = {
  desktopSrc?: string;
  mobileSrc?: string;
  ariaLabel?: string;
};

const HomeBanner = ({
  desktopSrc = STATIC_ASSETS.homeBannerDesktop,
  mobileSrc = STATIC_ASSETS.homeBannerMobile,
  ariaLabel = "Cevonne campaign",
}: HomeBannerProps) => {
  return (
    <section
      className="relative h-[calc(100svh-4rem)] w-full overflow-hidden bg-neutral-100 px-0 md:h-[calc(100svh-5rem)] md:px-0"
      aria-label={ariaLabel}
    >
      <picture className="absolute inset-0 block h-full w-full">
        <source media="(min-width: 768px)" srcSet={desktopSrc} />
        <img
          src={mobileSrc}
          alt={ariaLabel}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover"
        />
      </picture>
    </section>
  );
};

export default HomeBanner;
