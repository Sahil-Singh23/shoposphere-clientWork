import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "../api";
import { shuffleArray } from "../utils/shuffle";
import ProductCard from "./ProductCard";

export default function HorizontalProductCarousel({
  title,
  subtitle,
  products = null,
  productIds = [],
  excludeProductId = null,
  shuffleFetched = true,
  isLoading = false,
  showCounter = false,
  showControls = false,
  cardWrapperClassName = "shrink-0 basis-[calc((100%-0.5rem)/2)] lg:basis-[calc((100%-2rem)/5)] overflow-hidden",
  skeletonCount = 4,
  containerClassName = "",
  sectionClassName = "mt-12 lg:mt-14",
  titleClassName = "pd-headline text-xl sm:text-2xl font-black uppercase tracking-tighter text-[#1a1c1d]",
  subtitleClassName = "text-sm mt-1 text-[#474747]",
  loadingSkeletonClassName = "shrink-0 basis-[calc((100%-0.5rem)/2)] lg:basis-[calc((100%-2rem)/5)] rounded-lg animate-pulse",
  loadingTrackClassName = "flex gap-2 overflow-x-auto scroll-smooth scrollbar-hide pb-2",
  renderTrackClassName = "flex gap-2 overflow-x-auto scroll-smooth scrollbar-hide pb-2",
  hideScrollbar = true,
  className = "",
}) {
  const scrollContainerRef = useRef(null);
  const autoScrollTimeoutRef = useRef(null);
  const [fetchedByKey, setFetchedByKey] = useState({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const hasProvidedProducts = Array.isArray(products);
  const idsToFetch = useMemo(
    () => (excludeProductId ? productIds.filter((id) => Number(id) !== Number(excludeProductId)) : productIds),
    [excludeProductId, productIds]
  );
  const idsKey = useMemo(() => idsToFetch.join(","), [idsToFetch]);

  useEffect(() => {
    if (hasProvidedProducts || idsToFetch.length === 0 || fetchedByKey[idsKey] !== undefined) return;
    const ac = new AbortController();
    fetch(`${API}/products?ids=${idsToFetch.join(",")}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setFetchedByKey((prev) => ({
          ...prev,
          [idsKey]: shuffleFetched ? shuffleArray(list) : list,
        }));
      })
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("HorizontalProductCarousel fetch error:", err);
        setFetchedByKey((prev) => ({ ...prev, [idsKey]: [] }));
      });
    return () => ac.abort();
  }, [fetchedByKey, hasProvidedProducts, idsKey, idsToFetch, shuffleFetched]);

  const resolvedProducts = useMemo(() => {
    if (hasProvidedProducts) return products;
    return fetchedByKey[idsKey] ?? [];
  }, [fetchedByKey, hasProvidedProducts, idsKey, products]);

  const list = useMemo(
    () => resolvedProducts.filter((p) => !excludeProductId || p.id !== Number(excludeProductId)),
    [excludeProductId, resolvedProducts]
  );

  const resolvedLoading =
    isLoading || (!hasProvidedProducts && idsToFetch.length > 0 && fetchedByKey[idsKey] === undefined);

  const countText = useMemo(() => {
    if (!showCounter) return null;
    return subtitle || `${list.length} items selected just for you`;
  }, [list.length, showCounter, subtitle]);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [list]);

  useEffect(() => {
    if (!showControls || !scrollContainerRef.current || list.length === 0) return;

    const getScrollAmount = () => {
      const container = scrollContainerRef.current;
      if (!container) return 280;
      const firstCard = container.firstElementChild;
      if (!firstCard) return 280;

      const cardWidth = firstCard.getBoundingClientRect().width;
      const styles = window.getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return Math.max(200, Math.round(cardWidth + gap));
    };

    const autoScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      const maxScroll = scrollWidth - clientWidth;
      const scrollAmount = getScrollAmount();

      if (scrollLeft >= maxScroll) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    };

    autoScrollTimeoutRef.current = setInterval(autoScroll, 5000);

    return () => {
      if (autoScrollTimeoutRef.current) clearInterval(autoScrollTimeoutRef.current);
    };
  }, [list.length, showControls]);

  if (list.length === 0 && !resolvedLoading) return null;

  const handleScroll = (direction) => {
    if (!scrollContainerRef.current) return;

    const getScrollAmount = () => {
      const container = scrollContainerRef.current;
      if (!container) return 280;
      const firstCard = container.firstElementChild;
      if (!firstCard) return 280;

      const cardWidth = firstCard.getBoundingClientRect().width;
      const styles = window.getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return Math.max(200, Math.round(cardWidth + gap));
    };

    if (autoScrollTimeoutRef.current) {
      clearInterval(autoScrollTimeoutRef.current);
    }

    const scrollAmount = getScrollAmount();
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });

    setTimeout(() => {
      autoScrollTimeoutRef.current = setInterval(() => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const maxScroll = scrollWidth - clientWidth;
        const scrollAmount = getScrollAmount();
        if (scrollLeft >= maxScroll) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
      }, 5000);
    }, 500);
  };

  return (
    <section className={`${sectionClassName} ${className}`.trim()}>
      <div className="mb-6">
        <h2 className={titleClassName}>{title}</h2>
        {countText ? <p className={subtitleClassName}>{countText}</p> : null}
      </div>

      {resolvedLoading ? (
        <div className={loadingTrackClassName} style={{ WebkitOverflowScrolling: "touch" }}>
          {[...Array(skeletonCount)].map((_, i) => (
            <div key={i} className={loadingSkeletonClassName} style={{ backgroundColor: "oklch(92% .04 340)" }} />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className={`relative group ${containerClassName}`}>
          {showControls && canScrollLeft ? (
            <button
              onClick={() => handleScroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
              style={{ backgroundColor: "white", color: "oklch(20% .02 340)" }}
              aria-label="Scroll left"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          ) : null}

          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className={renderTrackClassName}
            style={{
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: hideScrollbar ? "none" : undefined,
            }}
          >
            {list.map((product) => (
              <div key={product.id} className={cardWrapperClassName}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>

          {showControls && canScrollRight ? (
            <button
              onClick={() => handleScroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
              style={{ backgroundColor: "white", color: "oklch(20% .02 340)" }}
              aria-label="Scroll right"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
