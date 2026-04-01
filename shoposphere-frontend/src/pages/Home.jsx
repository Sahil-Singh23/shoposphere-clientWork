import { useEffect, useMemo, useState, useRef } from "react";
import { API } from "../api";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { Link } from "react-router-dom";
import BannerSlider from "../components/BannerSlider";
import { MemoReelCarousel as ReelCarousel } from "../components/ReelCarousel";
import ProductCarouselSection from "../components/ProductCarouselSection";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import { useWishlist } from "../context/WishlistContext";
import { useUserAuth } from "../context/UserAuthContext";
import { shuffleArray } from "../utils/shuffle";

export default function Home() {
  const { recentIds } = useRecentlyViewed();
  const { wishlistItems } = useWishlist();
  const { isAuthenticated, getAuthHeaders } = useUserAuth();
  const [products, setProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reels, setReels] = useState([]);
  const [banners, setBanners] = useState([]);
  const [topRatedProducts, setTopRatedProducts] = useState([]);
  const [buyAgainIds, setBuyAgainIds] = useState([]);
  const [visibleProductsCount, setVisibleProductsCount] = useState(10);
  const [loading, setLoading] = useState({
    categories: true,
    products: true,
    reels: true,
    banners: true,
  });
  const scrollRef = useRef(null);
  const scrollEndTimerRef = useRef(null);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    // Auto-advance the hero visuals (respect reduced motion where possible).
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) return;
    const t = setInterval(() => setHeroSlide((s) => (s + 1) % 3), 4800);
    return () => clearInterval(t);
  }, []);
  
  // Single request for homepage data (faster: 1 round-trip instead of 5)
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API}/home`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.error) {
          setLoading((prev) => ({ ...prev, categories: false, products: false, reels: false, banners: false }));
          return;
        }
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        const list = shuffleArray(Array.isArray(data.products) ? data.products : []);
        setProducts(list);
        setTrendingProducts(list.filter((p) => p.isTrending));
        setReels(Array.isArray(data.reels) ? data.reels : []);
        setBanners(Array.isArray(data.banners) ? data.banners : []);
        setLoading((prev) => ({ ...prev, categories: false, products: false, reels: false, banners: false }));
      })
      .catch(() => {
        setLoading((prev) => ({ ...prev, categories: false, products: false, reels: false, banners: false }));
      });
    return () => ac.abort();
  }, []);

  // Lazy: top-rated products
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API}/products/top-rated?limit=12`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => setTopRatedProducts(Array.isArray(data) ? data : []))
      .catch(() => setTopRatedProducts([]));
    return () => ac.abort();
  }, []);

  // Lazy: buy-again product IDs (authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setBuyAgainIds([]);
      return;
    }
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    const ac = new AbortController();
    fetch(`${API}/orders/my-orders`, { headers, credentials: "include", signal: ac.signal })
      .then((res) => res.json())
      .then((orders) => {
        if (!Array.isArray(orders)) return;
        const ids = [];
        const seen = new Set();
        for (const order of orders) {
          const items = order.items || order.orderItems || [];
          for (const item of items) {
            const pid = item.productId ?? item.product?.id;
            if (pid && !seen.has(pid)) {
              seen.add(pid);
              ids.push(pid);
            }
          }
        }
        setBuyAgainIds(ids.slice(0, 12));
      })
      .catch(() => setBuyAgainIds([]));
    return () => ac.abort();
  }, [isAuthenticated, getAuthHeaders]);

  // Clean up scroll-end timers on unmount
  useEffect(() => {
    return () => {
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    };
  }, []);

  // After initial content is visible, progressively render more product cards
  useEffect(() => {
    if (!products.length) return;
    if (visibleProductsCount >= Math.min(products.length, 25)) return;
    const t = setTimeout(() => setVisibleProductsCount((c) => Math.min(c + 5, 25)), 600);
    return () => clearTimeout(t);
  }, [products.length, visibleProductsCount]);

  const visibleProducts = useMemo(
    () => (Array.isArray(products) ? products.slice(0, visibleProductsCount) : []),
    [products, visibleProductsCount]
  );

  // Removed getCategoryIcon - all categories use logo as fallback

  // Infinite carousel: triple the list so we can scroll seamlessly and reset position
  const categoriesTriple = useMemo(
    () => (categories.length > 0 ? [...categories, ...categories, ...categories] : []),
    [categories]
  );
  const categorySetWidthRef = useRef(0);

  // Initialize scroll position to middle set and handle loop reset (categories)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || categories.length === 0) return;
    const setWidth = el.scrollWidth / 3;
    categorySetWidthRef.current = setWidth;
    el.scrollLeft = setWidth;
  }, [categories]);

  const scrollCategories = (direction) => {
    const el = scrollRef.current;
    if (!el || categories.length === 0) return;
    const scrollAmount = 300;
    el.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    const setWidth = categorySetWidthRef.current || el.scrollWidth / 3;
    setTimeout(() => {
      if (!scrollRef.current) return;
      const sl = scrollRef.current.scrollLeft;
      if (sl >= setWidth * 2 - 50) scrollRef.current.scrollLeft = sl - setWidth;
      else if (sl <= 50) scrollRef.current.scrollLeft = sl + setWidth;
    }, 350);
  };

  // Scroll loop reset on scroll end (for drag/swipe and so middle set stays in sync)
  const handleCategoryScrollEnd = () => {
    const el = scrollRef.current;
    if (!el || categories.length === 0) return;
    const setWidth = categorySetWidthRef.current || el.scrollWidth / 3;
    const sl = el.scrollLeft;
    if (sl >= setWidth * 2 - 50) el.scrollLeft = sl - setWidth;
    else if (sl <= 50) el.scrollLeft = sl + setWidth;
  };
  // Check if any data is still loading
  const isInitialLoad = loading.categories || loading.products || loading.reels || loading.banners;

  // Store photos in `public/`: shop1.jpeg … shop6.jpeg. Fallbacks if a file is missing.
  const storeImages = useMemo(
    () => [
      { src: "/shop1.jpeg", fallbackSrc: "/hero1.png", alt: "Store entrance" },
      { src: "/shop2.jpeg", fallbackSrc: "/hero2.png", alt: "Wood shelf display" },
      { src: "/shop3.jpeg", fallbackSrc: "/hero.png", alt: "Fresh baskets" },
      { src: "/shop4.jpeg", fallbackSrc: "/model.png", alt: "Fruit counter" },
      { src: "/shop5.jpeg", fallbackSrc: "/mins.png", alt: "Shelf details" },
      { src: "/shop6.jpeg", fallbackSrc: "/logo.png", alt: "Visit the store" },
    ],
    []
  );

  const heroFruitStages = useMemo(
    () => [
      {
        blueberries: { objectPosition: "80% 86%", left: "-160px", top: "-120px", scale: 1.16, rotate: "-3deg" },
        cherries: { objectPosition: "58% 78%", left: "-90px", top: "-70px", scale: 1.12, rotate: "4deg" },
        frame1: { left: "-120px", top: "30px", scale: 0.34 },
        frame2: { right: "-140px", bottom: "-10px", scale: 0.36 },
      },
      {
        blueberries: { objectPosition: "78% 82%", left: "-150px", top: "-105px", scale: 1.18, rotate: "1deg" },
        cherries: { objectPosition: "55% 80%", left: "-70px", top: "-60px", scale: 1.10, rotate: "-6deg" },
        frame1: { left: "-105px", top: "20px", scale: 0.32 },
        frame2: { right: "-150px", bottom: "-20px", scale: 0.38 },
      },
      {
        blueberries: { objectPosition: "82% 88%", left: "-170px", top: "-130px", scale: 1.14, rotate: "-1deg" },
        cherries: { objectPosition: "62% 76%", left: "-105px", top: "-55px", scale: 1.11, rotate: "6deg" },
        frame1: { left: "-130px", top: "38px", scale: 0.35 },
        frame2: { right: "-135px", bottom: "-5px", scale: 0.35 },
      },
    ],
    []
  );

  return (
    <div className="min-h-screen fade-in" style={{ backgroundColor: 'var(--background)' }}>
      <>
          {/* Hero Banner Section */}
          <section className="hidden md:block max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6" aria-label="Homepage hero banner">
            <div
              className="relative w-full h-[280px] md:h-[300px] rounded-lg overflow-hidden flex items-center"
              style={{
                backgroundColor: "var(--secondary)",
                boxShadow: "0 10px 30px -5px rgba(74, 55, 40, 0.08)",
                border: "1px solid rgba(141, 110, 99, 0.15)",
              }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: "radial-gradient(circle at 70% 30%, #D2B48C 0%, transparent 60%)" }}
              />

              <div className="relative z-10 w-full flex flex-row items-center justify-between gap-3 md:gap-4 px-6 sm:px-10 md:px-14 py-3 h-full">
                <div className="flex flex-1 min-w-0 flex-col gap-2.5 pr-1 md:pr-2">
                  <div
                    className="inline-block px-3 py-1 rounded w-fit text-[9px] tracking-[0.2em] uppercase font-bold"
                    style={{ border: "1px solid rgba(210,180,140,0.9)", color: "var(--primary)" }}
                  >
                    New Arrivals
                  </div>

                  <h3
                    className="font-display font-bold text-xl md:text-2xl lg:text-2xl leading-[0.95] tracking-tight"
                    style={{ color: "var(--primary)" }}
                  >
                    Nurtured by Nature,
                    <br />
                    Delivered to You
                  </h3>

                  <div className="relative mt-1 w-fit">
                    <div
                      className="absolute -inset-2 rounded-md pointer-events-none"
                      style={{ background: "radial-gradient(circle, rgba(210,180,140,0.26) 0%, rgba(210,180,140,0) 75%)" }}
                      aria-hidden
                    />
                    <Link
                      to="/categories"
                      className="group relative inline-flex items-center gap-3 py-3.5 px-9 uppercase tracking-[0.18em] text-[11px] font-bold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(74,55,40,0.52)] active:translate-y-0"
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                        boxShadow: "0 14px 32px -10px rgba(74, 55, 40, 0.38)",
                        borderRadius: 4,
                      }}
                    >
                      Shop Fresh Now
                      <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  <p className="text-xs md:text-sm max-w-xs md:max-w-md leading-relaxed opacity-80" style={{ color: "var(--text-muted)" }}>
                    30-minute delivery on handpicked fresh fruits.
                  </p>
                </div>

                <div className="hidden md:flex relative h-full w-[400px] lg:w-[460px] items-center justify-end ml-1 lg:ml-2">
                  <div
                    className="absolute right-0 w-44 h-44 lg:w-52 lg:h-52 rounded-sm overflow-hidden transition-all duration-700"
                    style={{
                      boxShadow: "0 8px 24px -10px rgba(74, 55, 40, 0.20)",
                      border: "1px solid rgba(141, 110, 99, 0.15)",
                      filter: "saturate(0.84) contrast(0.9) brightness(0.97)",
                      opacity: 0.92,
                    }}
                  >
                    <img alt="Fresh oranges" className="w-full h-full object-cover" src="/shop4.png" loading="lazy" decoding="async" fetchPriority="low" />
                  </div>
                  <div
                    className="absolute bottom-4 right-24 lg:right-32 w-36 h-36 lg:w-44 lg:h-44 rounded-sm overflow-hidden rotate-2 z-20"
                    style={{
                      boxShadow: "0 10px 24px -10px rgba(74, 55, 40, 0.24)",
                      border: "4px solid var(--background)",
                      filter: "saturate(0.9) contrast(0.94)",
                    }}
                  >
                    <img alt="Fresh berries" className="w-full h-full object-cover" src="/shop1.jpeg" loading="lazy" decoding="async" fetchPriority="low" />
                  </div>
                  <div
                    className="absolute top-8 right-[12.5rem] lg:top-6 lg:right-64 w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden -rotate-3 z-10"
                    style={{
                      boxShadow: "0 8px 20px -10px rgba(74, 55, 40, 0.22)",
                      border: "2px solid rgba(210,180,140,0.24)",
                      filter: "saturate(0.84) contrast(0.92)",
                      opacity: 0.9,
                    }}
                  >
                    <img alt="Leafy greens" className="w-full h-full object-cover" src="/shop1.jpeg" loading="lazy" decoding="async" fetchPriority="low" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Primary Banner Slider (admin-managed banners) */}
          {!isInitialLoad && <BannerSlider bannerType="primary" />}



          {/* Shop By Category Section */}
      {categories.length > 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div
            className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,246,231,0.82) 0%, rgba(244,219,186,0.45) 55%, rgba(245,230,211,0.78) 100%), " +
                "url('/wooden.jpg') center / cover no-repeat",
              backgroundBlendMode: "screen, normal",
              boxShadow:
                "0 18px 34px rgba(92,57,34,0.28), 0 6px 0 rgba(126,82,53,0.34), inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -2px 0 rgba(93,56,31,0.18)",
            }}
          >
            <div
              className="absolute inset-[-10%] pointer-events-none"
              style={{
                backgroundImage: "url('/wooden.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                transform: "rotate(-3deg) scale(1.05)",
                opacity: 0.16,
                mixBlendMode: "soft-light",
                filter: "saturate(0.9) contrast(1.02) brightness(1.08)",
              }}
              aria-hidden
            />

            {/* 3D slab faces */}
            <div
              className="absolute left-2 right-2 bottom-0 h-6 pointer-events-none"
              style={{
                background: "linear-gradient(0deg, rgba(88,53,31,0.34) 0%, rgba(151,110,79,0.16) 70%, rgba(255,255,255,0.10) 100%)",
                borderBottomLeftRadius: "calc(var(--radius-2xl) - 4px)",
                borderBottomRightRadius: "calc(var(--radius-2xl) - 4px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            />
            <div
              className="absolute left-0 top-3 bottom-3 w-3 pointer-events-none"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.26) 0%, rgba(133,92,61,0.08) 100%)" }}
            />
            <div
              className="absolute right-0 top-3 bottom-3 w-3 pointer-events-none"
              style={{ background: "linear-gradient(270deg, rgba(255,255,255,0.20) 0%, rgba(133,92,61,0.10) 100%)" }}
            />

            <div className="relative px-5 sm:px-8 pt-6 sm:pt-8 pb-6 sm:pb-8">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h2 className="font-display text-xl font-extrabold text-design-foreground">Shop By Category</h2>
                <Link
                  to="/categories"
                  className="text-sm font-semibold inline-flex items-center gap-1 transition-all duration-300 hover:gap-2 group text-design-foreground hover:opacity-80"
                >
                  View All
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              <div className="relative">
                <button
                  onClick={() => scrollCategories("left")}
                  className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-10 rounded-full p-1 sm:p-2 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 border active:scale-95"
                  style={{
                    backgroundColor: "rgba(245,230,211,0.78)",
                    borderColor: "rgba(107,62,38,0.25)",
                  }}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-design-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div
                  ref={scrollRef}
                  className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-4 px-8 sm:px-10"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  onScroll={() => {
                    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
                    scrollEndTimerRef.current = setTimeout(handleCategoryScrollEnd, 150);
                  }}
                >
                  {categoriesTriple.map((category, i) => (
                    <Link
                      key={`cat-${i}-${category.id}`}
                      to={`/category/${category.slug}`}
                      className="flex-shrink-0 flex flex-col items-center min-w-[100px] sm:min-w-[120px] group"
                    >
                      {/* Icon + label tile on wooden shelf */}
                      <div
                        className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-[var(--radius-xl)] flex items-center justify-center overflow-hidden cursor-pointer transition-all duration-300 group-hover:-translate-y-0.5"
                        style={{
                          // backgroundColor: "#ffffff",
                          // border: "none",
                        }}
                      >
                        <div
                          className="w-[calc(100%-6px)] h-[calc(100%-6px)] rounded-[var(--radius-lg)] flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]"
                          style={{
                            backgroundColor: "#ffffff",
                            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                          }}
                        >
                          {category.imageUrl ? (
                            <img
                              src={category.imageUrl}
                              alt={category.name}
                              className="w-full h-full object-contain"
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          ) : (
                            <img
                              src="/logo.png"
                              alt="SK Fruits"
                              className="w-3/4 h-3/4 object-contain"
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-center transition-colors mt-2 text-design-muted group-hover:text-design-foreground">
                        {category.name}
                      </span>
                    </Link>
                  ))}
                </div>

                <button
                  onClick={() => scrollCategories("right")}
                  className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-10 rounded-full p-1 sm:p-2 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 border active:scale-95"
                  style={{
                    backgroundColor: "rgba(245,230,211,0.78)",
                    borderColor: "rgba(107,62,38,0.25)",
                  }}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-design-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}


      {/* Popular Fruits (Trending) */}
      {isInitialLoad ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ backgroundColor: "var(--background)" }}>
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-display text-xl font-bold text-design-foreground">Popular Fruits</h2>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 px-1 snap-x snap-mandatory scrollbar-thin">
            {[...Array(6)].map((_, i) => (
              <div key={`pop-skel-${i}`} className="shrink-0 snap-start w-[48%] lg:w-[20%]">
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ) : trendingProducts.length > 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ backgroundColor: 'var(--background)' }}>
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-display text-xl font-bold text-design-foreground">Popular Fruits</h2>
            <Link
              to="/categories?trending=true"
              className="text-sm font-semibold inline-flex items-center gap-1 transition-all duration-300 hover:gap-2 group text-design-foreground hover:opacity-80"
            >
              View All
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div
            className="flex gap-5 overflow-x-auto pb-4 px-1 snap-x snap-mandatory scrollbar-thin"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {trendingProducts.map((p) => (
              <div
                key={p.id}
                className="shrink-0 snap-start w-[48%] lg:w-[20%]"
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Top Rated */}
      {topRatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <ProductCarouselSection title="Top Rated" products={topRatedProducts} />
        </div>
      )}

       {/* Personalized: Recently Viewed */}
       {recentIds.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <ProductCarouselSection title="Recently Viewed" productIds={recentIds} />
        </div>
      )}

      {/* Delivery in 30 mins banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* <img
          src="/mins.png"
          alt=""
          width={752}
          height={332}
          className="w-full max-w-[752px] h-auto mx-auto object-contain rounded-xl"
          style={{ aspectRatio: "752 / 332" }}
        /> */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 flex items-center gap-5 shadow-lg"
          style={{ background: "linear-gradient(135deg, #16a34a 0%, #059669 100%)" }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: "#fff" }} />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-10" style={{ background: "#fff" }} />

          <div className="relative z-10 flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-8 h-8 sm:w-9 sm:h-9 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="relative z-10">
            <h3 className="text-xl sm:text-xl font-bold text-white leading-snug">
              Delivery in less than <span className="text-yellow-300">60 mins</span>
            </h3>
            <p className="text-sm sm:text-base text-white/80 mt-1">
              Fresh fruits &amp; groceries at your doorstep — lightning fast
            </p>
          </div>
        </div>
      </div>

      {/* Personalized: Buy Again */}
      {buyAgainIds.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <ProductCarouselSection title="Buy Again" productIds={buyAgainIds} />
        </div>
      )}

      {/* Trending Gifts Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ backgroundColor: 'var(--background)' }}>
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-display text-xl font-bold text-design-foreground">Our Products</h2>
            {products.length > 0 && (
              <Link
                to="/shop"
                className="text-sm font-semibold inline-flex items-center gap-1 transition-all duration-300 hover:gap-2 group text-design-foreground hover:opacity-80"
              >
                View All
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {visibleProducts.length > 0 ? (
              visibleProducts.map((p) => <ProductCard key={p.id} product={p} />)
            ) : isInitialLoad ? (
              Array.from({ length: 10 }).map((_, i) => (
                <ProductCardSkeleton key={`our-skel-${i}`} />
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <div className="inline-block p-6 rounded-full mb-4 bg-design-secondary">
                  <img src="/logo.png" alt="SK Fruits" className="w-16 h-16 object-contain" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2 text-design-foreground">SK Fruits</h3>
                <p className="font-medium text-design-muted">
                  More amazing gifts coming soon!
                </p>
              </div>
            )}
          </div>
        </div>

      {/* Why Choose Us (trust section) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Store Experience Section */}
        <div className="mb-10 sm:mb-12" style={{ backgroundColor: "transparent" }}>
          <section
            className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,246,231,0.82) 0%, rgba(244,219,186,0.45) 55%, rgba(245,230,211,0.78) 100%), " +
                "url('/wooden.jpg') center / cover no-repeat",
              backgroundBlendMode: "screen, normal",
              boxShadow:
                "0 18px 34px rgba(92,57,34,0.28), 0 6px 0 rgba(126,82,53,0.34), inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -2px 0 rgba(93,56,31,0.18)",
            }}
            aria-label="Visit Our Store"
          >
            <div
              className="absolute inset-[-10%] pointer-events-none"
              style={{
                backgroundImage: "url('/wooden.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                transform: "rotate(-3deg) scale(1.05)",
                opacity: 0.16,
                mixBlendMode: "soft-light",
                filter: "saturate(0.9) contrast(1.02) brightness(1.08)",
              }}
              aria-hidden
            />

            <div
              className="absolute left-2 right-2 bottom-0 h-6 pointer-events-none"
              style={{
                background: "linear-gradient(0deg, rgba(88,53,31,0.34) 0%, rgba(151,110,79,0.16) 70%, rgba(255,255,255,0.10) 100%)",
                borderBottomLeftRadius: "calc(var(--radius-2xl) - 4px)",
                borderBottomRightRadius: "calc(var(--radius-2xl) - 4px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            />
            <div
              className="absolute left-0 top-3 bottom-3 w-3 pointer-events-none"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.26) 0%, rgba(133,92,61,0.08) 100%)" }}
            />
            <div
              className="absolute right-0 top-3 bottom-3 w-3 pointer-events-none"
              style={{ background: "linear-gradient(270deg, rgba(255,255,255,0.20) 0%, rgba(133,92,61,0.10) 100%)" }}
            />

            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 20% 0%, rgba(255,213,128,0.20), transparent 55%)" }} />

            <div className="relative px-5 sm:px-8 pt-6 pb-5">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-design-foreground">Visit Our Store</h2>
                  <p className="mt-2 text-sm sm:text-base text-design-muted">
                    Step inside our premium fruit shop & explore fresh baskets.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {storeImages.map((img, idx) => (
                  <div
                    key={`store-img-${idx}`}
                    className="group rounded-[var(--radius-lg)] overflow-hidden border"
                    style={{ borderColor: "rgba(107,62,38,0.22)", backgroundColor: "rgba(255,255,255,0.35)" }}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (img.fallbackSrc && target.src !== img.fallbackSrc) {
                          target.onerror = null; // avoid infinite error loops
                          target.src = img.fallbackSrc;
                        }
                      }}
                      className="h-40 sm:h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section
          className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,246,231,0.82) 0%, rgba(244,219,186,0.45) 55%, rgba(245,230,211,0.78) 100%), " +
              "url('/wooden.jpg') center / cover no-repeat",
            backgroundBlendMode: "screen, normal",
            boxShadow:
              "0 18px 34px rgba(92,57,34,0.28), 0 6px 0 rgba(126,82,53,0.34), inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -2px 0 rgba(93,56,31,0.18)",
          }}
          aria-label="Why Choose Us"
        >
          <div
            className="absolute inset-[-10%] pointer-events-none"
            style={{
              backgroundImage: "url('/wooden.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: "rotate(-3deg) scale(1.05)",
              opacity: 0.16,
              mixBlendMode: "soft-light",
              filter: "saturate(0.9) contrast(1.02) brightness(1.08)",
            }}
            aria-hidden
          />

          <div
            className="absolute left-2 right-2 bottom-0 h-6 pointer-events-none"
            style={{
              background: "linear-gradient(0deg, rgba(88,53,31,0.34) 0%, rgba(151,110,79,0.16) 70%, rgba(255,255,255,0.10) 100%)",
              borderBottomLeftRadius: "calc(var(--radius-2xl) - 4px)",
              borderBottomRightRadius: "calc(var(--radius-2xl) - 4px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          />
          <div
            className="absolute left-0 top-3 bottom-3 w-3 pointer-events-none"
            style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.26) 0%, rgba(133,92,61,0.08) 100%)" }}
          />
          <div
            className="absolute right-0 top-3 bottom-3 w-3 pointer-events-none"
            style={{ background: "linear-gradient(270deg, rgba(255,255,255,0.20) 0%, rgba(133,92,61,0.10) 100%)" }}
          />

          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 70% 10%, rgba(255,213,128,0.12), transparent 50%)" }} />

          <div className="relative px-5 sm:px-8 py-6 sm:py-8">
            <div className="flex items-end justify-between gap-6 mb-6">
              <div>
                <h2 className="font-display text-xl font-bold text-design-foreground">Why Choose Us</h2>
                <p className="mt-2 text-sm sm:text-base text-design-muted">
                  Premium quality, fresh selection, and fast delivery—made simple.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: "Fresh Today", desc: "Carefully selected fruits every day.", icon: "spark" },
                { title: "Premium Quality", desc: "Handpicked for taste and texture.", icon: "leaf" },
                { title: "Fast Delivery", desc: "Quick packing and on-time delivery.", icon: "truck" },
                { title: "Trusted Service", desc: "Friendly support for every order.", icon: "heart" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[var(--radius-lg)] border"
                  style={{
                    borderColor: "rgba(133,92,61,0.2)",
                    backgroundColor: "rgba(255,252,246,0.9)",
                    boxShadow: "0 8px 18px rgba(86,60,40,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
                  }}
                >
                  <div className="p-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                      style={{ backgroundColor: "rgba(255,213,128,0.55)", color: "var(--primary)", boxShadow: "var(--shadow-card)" }}
                    >
                      {item.icon === "spark" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.5 6L20 9.5l-6.5 1.5L12 18l-1.5-6.5L4 9.5l6.5-1.5L12 2z" />
                        </svg>
                      ) : item.icon === "leaf" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 3s-6 1-10 5-5 10-5 10 6-1 10-5 5-10 5-10z" />
                        </svg>
                      ) : item.icon === "truck" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17h2l2-7h12l2 7h2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                        </svg>
                      )}
                    </div>
                    <div className="font-bold" style={{ color: "var(--foreground)" }}>{item.title}</div>
                    <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Secondary Banner Section - Between Gifts and Reels */}
      {!isInitialLoad && <BannerSlider bannerType="secondary" />}
      
      {/* Personalized: From Your Wishlist */}
      {wishlistItems.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <ProductCarouselSection
            title="From Your Wishlist"
            products={wishlistItems.map((item) => item.product).filter(Boolean)}
          />
        </div>
      )}

      {/* Reels Section */}
      {reels.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ backgroundColor: 'var(--background)' }}>
            <h2 className="font-display text-xl font-bold mb-8 text-center text-design-foreground">
              Follow Us{" "}
              <a
                href=""
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition-all text-[var(--primary)]"
              >
                
              </a>
            </h2>
            <ReelCarousel reels={reels} />
          </div>
      )}
      </>
    </div>
  );
}
