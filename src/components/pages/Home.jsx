import HeroSection from "../home/HeroSection";
import IntroVideo1 from "../home/IntroVideo1";
import ProductCard from "../home/ProductCard";
import IntroVideo2 from "../home/IntroVideo2";
import IntroVideo3 from "../home/IntroVideo3";
import ProductCard2 from "../home/ProductCard2";
import ProductCard3 from "../home/ProductCard3";

const Home = () => {
  return (
    <>
      <section className="border-b border-neutral-200 bg-[linear-gradient(90deg,#f7f1e8_0%,#ffffff_50%,#f7f1e8_100%)]">
        <div className="mx-auto max-w-screen-2xl px-6 py-3 text-center text-xs font-medium tracking-[0.12em] text-neutral-700 md:px-10 lg:px-14 md:text-sm">
          Cevonne is a brand owned and operated by Marvella Cosmetics OPC Pvt Ltd, India.
        </div>
      </section>
      <HeroSection />
      <IntroVideo1 />
      <ProductCard />
      <IntroVideo2 />
      <ProductCard2 />
      <IntroVideo3 />
      <ProductCard3 />
    </>
  );
};

export default Home;
