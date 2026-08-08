"use client";

import HeroSection from "../home/HeroSection";
import CollectionSection from "../home/CollectionSection";
import ProductCard from "../home/ProductCard";
import HomeBanner from "../home/HomeBanner";
import ProductCard2 from "../home/ProductCard2";
import ProductCard3 from "../home/ProductCard3";
import NewsletterLeadForm from "../forms/NewsletterLeadForm";
import { STATIC_ASSETS } from "@/lib/assets";

const Home = () => {
  return (
    <>
      <HeroSection />
      <CollectionSection />
      <ProductCard />
      <HomeBanner />
      <ProductCard2 />
      <HomeBanner
        desktopSrc={STATIC_ASSETS.homeBanner2Desktop}
        mobileSrc={STATIC_ASSETS.homeBanner2Mobile}
        ariaLabel="Cevonne campaign collection"
      />
      <ProductCard3 />
      <NewsletterLeadForm />
    </>
  );
};

export default Home;
