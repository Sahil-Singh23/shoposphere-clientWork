import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { API } from "../api";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "../context/ToastContext";
import ProductCard from "../components/ProductCard";
import RecommendationCarousel from "../components/RecommendationCarousel";
import StarRating from "../components/StarRating";
import { initializeInstagramEmbeds } from "../utils/instagramEmbed";
import { useUserAuth } from "../context/UserAuthContext";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import ProductCarouselSection from "../components/ProductCarouselSection";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist, togglingId } = useWishlist();
  const { recentIds, addViewed } = useRecentlyViewed();
  const { isAuthenticated, getAuthHeaders } = useUserAuth();
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set(["details"]));
  const [similarProducts, setSimilarProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [reviewsData, setReviewsData] = useState({ averageRating: 0, totalReviews: 0, reviews: [] });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submitReviewLoading, setSubmitReviewLoading] = useState(false);
  const isWishlisted = product ? isInWishlist(product.id) : false;
  const isWishlistToggling = product && togglingId === product.id;
  
  const images = useMemo(() => {
    if (!product?.images) return [];
    if (Array.isArray(product.images)) return product.images;
    try {
      const parsed = JSON.parse(product.images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [product?.images]);

  const videos = useMemo(() => {
    if (!product?.videos || !Array.isArray(product.videos)) return [];
    return product.videos;
  }, [product?.videos]);

  const instagramEmbeds = useMemo(() => {
    if (!product?.instagramEmbeds) return [];
    if (Array.isArray(product.instagramEmbeds)) return product.instagramEmbeds.filter(e => e.enabled);
    try {
      const parsed = JSON.parse(product.instagramEmbeds);
      return Array.isArray(parsed) ? parsed.filter(e => e.enabled) : [];
    } catch {
      return [];
    }
  }, [product?.instagramEmbeds]);

  // Combined media: images, videos, and Instagram embeds
  const media = useMemo(() => {
    const imgItems = images.map((url) => ({ type: "image", url }));
    const vidItems = videos.map((url) => ({ type: "video", url }));
    const instaItems = instagramEmbeds.map((embed) => ({ type: "instagram", url: embed.url }));
    return [...imgItems, ...vidItems, ...instaItems];
  }, [images, videos, instagramEmbeds]);

  const activeMedia = media[activeImageIndex] || media[0] || null;
  const activeImage = activeMedia?.type === "image" ? activeMedia.url : null;
  const activeVideo = activeMedia?.type === "video" ? activeMedia.url : null;
  const activeInstagram = activeMedia?.type === "instagram" ? activeMedia.url : null;
  const instagramEmbedRef = useRef(null);

  const toggleSection = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(`${API}/products/${id}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        setProduct(data);
        if (data?.id) addViewed(data.id);
        // Handle weight-based products (fruits)
        if (data?.weightOptions) {
          try {
            const weightOpts = Array.isArray(data.weightOptions) ? data.weightOptions : JSON.parse(data.weightOptions);
            if (weightOpts.length > 0) {
              setSelectedWeight(weightOpts[0].weight);
              setSelectedSize(null);
            }
          } catch {
            setSelectedWeight(null);
            setSelectedSize(null);
          }
        }
        // Handle single price products
        else if (data?.hasSinglePrice && data.singlePrice) {
          setSelectedSize({
            id: 0,
            label: "Standard",
            price: parseFloat(data.singlePrice),
            originalPrice: data.originalPrice != null && data.originalPrice !== "" ? parseFloat(data.originalPrice) : null,
          });
        } else if (data?.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        } else {
          setSelectedSize(null);
        }
        setQuantity(1);
        setActiveImageIndex(0);
        setLoading(false);

        // Initialize Instagram embeds if present (after DOM renders)
        if (data?.instagramEmbeds?.length > 0) {
          setTimeout(() => initializeInstagramEmbeds(), 300);
        }

        // Fetch recommendations using the recommendation engine
        setLoadingRecommendations(true);
        fetch(`${API}/recommendations/${data.id}?limit=10`, { signal: ac.signal })
          .then((res) => res.json())
          .then((products) => {
            setRecommendedProducts(Array.isArray(products) ? products : []);
            setLoadingRecommendations(false);
          })
          .catch((error) => {
            if (error?.name === "AbortError") return;
            console.error("Error fetching recommendations:", error);
            setLoadingRecommendations(false);
          });

        // Fetch similar products from the same category (use first category if multiple)
        const firstCategory = data?.categories && data.categories.length > 0 ? data.categories[0] : data?.category;
        if (firstCategory?.slug) {
          fetch(`${API}/products?category=${firstCategory.slug}&limit=10`, { signal: ac.signal })
            .then((res) => res.json())
            .then((products) => {
              // Filter out the current product
              const similar = Array.isArray(products) 
                ? products.filter((p) => p.id !== Number(id))
                : [];
              setSimilarProducts(similar);
            })
            .catch((error) => {
              if (error?.name === "AbortError") return;
              console.error("Error fetching similar products:", error);
            });
        }
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        console.error("Error fetching product:", error);
        setLoading(false);
      });

    return () => ac.abort();
  }, [id]);

  // Fetch reviews for this product
  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    setReviewsLoading(true);
    fetch(`${API}/products/${id}/reviews`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.averageRating !== undefined && Array.isArray(data.reviews)) {
          setReviewsData({
            averageRating: data.averageRating,
            totalReviews: data.totalReviews,
            reviews: data.reviews,
          });
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Reviews fetch error:", err);
      })
      .finally(() => setReviewsLoading(false));
    return () => ac.abort();
  }, [id]);

  // Fetch review eligibility when logged in
  useEffect(() => {
    if (!id || !isAuthenticated) {
      setEligibility(null);
      return;
    }
    const ac = new AbortController();
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    setEligibilityLoading(true);
    fetch(`${API}/reviews/eligibility/${id}`, { headers, credentials: "include", signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        setEligibility({
          canReview: data.canReview === true,
          hasPurchased: data.hasPurchased === true,
          existingReview: data.existingReview ?? null,
        });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Eligibility fetch error:", err);
        setEligibility(null);
      })
      .finally(() => setEligibilityLoading(false));
    return () => ac.abort();
  }, [id, isAuthenticated, getAuthHeaders]);

  const handleSubmitReview = async () => {
    if (!product?.id || reviewRating < 1 || reviewRating > 5) {
      toast.error("Please select a rating (1–5 stars)");
      return;
    }
    setSubmitReviewLoading(true);
    const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
    try {
      const res = await fetch(`${API}/reviews/add`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ productId: product.id, rating: reviewRating, comment: reviewComment.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setEligibility((prev) => (prev ? { ...prev, canReview: false, existingReview: { id: data.id, rating: data.rating, comment: data.comment, createdAt: data.createdAt } } : null));
        setReviewRating(0);
        setReviewComment("");
        toast.success("Thank you for your review!");
        const refetch = await fetch(`${API}/products/${product.id}/reviews`);
        const refetchData = await refetch.json();
        if (refetch.ok && refetchData.averageRating !== undefined && Array.isArray(refetchData.reviews)) {
          setReviewsData({
            averageRating: refetchData.averageRating,
            totalReviews: refetchData.totalReviews,
            reviews: refetchData.reviews,
          });
        }
      } else {
        toast.error(data.error || "Could not submit review");
      }
    } catch (err) {
      console.error("Submit review error:", err);
      toast.error("Could not submit review");
    } finally {
      setSubmitReviewLoading(false);
    }
  };

  // Variant-specific stock (weight, size, or product-level)
  const stock = useMemo(() => {
    if (!product) return 0;
    if (selectedWeight && product.weightOptions) {
      try {
        const opts = Array.isArray(product.weightOptions) ? product.weightOptions : JSON.parse(product.weightOptions || "[]");
        const w = opts.find((o) => String(o.weight).trim() === String(selectedWeight).trim());
        if (w) return Math.max(0, Number(w.stock ?? product.stock ?? 0));
      } catch { /* ignore parse error */ }
      return 0;
    }
    if (selectedSize && selectedSize.id !== 0) {
      const s = product.sizes?.find((sz) => sz.id === selectedSize.id);
      if (s && typeof s.stock === "number") return Math.max(0, s.stock);
    }
    return Math.max(0, typeof product.stock === "number" ? product.stock : 0);
  }, [product, selectedWeight, selectedSize]);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;
  const maxQty = Math.max(1, stock);

  const handleAddToCart = () => {
    if (outOfStock) {
      toast.error("This product is out of stock");
      return;
    }
    // Check for weight-based products first
    if (selectedWeight) {
      const qty = Math.min(quantity, maxQty);
      addToCart(product, null, qty, selectedWeight);
      return;
    }
    // Fallback to size-based or single-price products
    if (!selectedSize && !(product?.hasSinglePrice && product?.singlePrice)) {
      toast.error("Please select a size or weight");
      return;
    }
    const qty = Math.min(quantity, maxQty);
    addToCart(product, selectedSize, qty);
  };

  const stickyCanAdd = useMemo(() => {
    if (!product) return false;
    const hasSelection = Boolean(selectedWeight || selectedSize || (product?.hasSinglePrice && product?.singlePrice));
    return !outOfStock && hasSelection;
  }, [product, selectedWeight, selectedSize, outOfStock]);

  const stickyPriceText = useMemo(() => {
    if (!product) return "Select size/weight";
    try {
      if (selectedWeight && product?.weightOptions) {
        const opts = Array.isArray(product.weightOptions) ? product.weightOptions : JSON.parse(product.weightOptions || "[]");
        const w = opts.find((o) => String(o.weight).trim() === String(selectedWeight).trim());
        if (w) return `₹${Number(w.price).toLocaleString("en-IN")}`;
      }

      if (selectedSize && selectedSize.id !== 0) {
        return `₹${Number(selectedSize.price).toLocaleString("en-IN")}`;
      }

      if (product?.hasSinglePrice && product?.singlePrice != null) {
        return `₹${Number(product.singlePrice).toLocaleString("en-IN")}`;
      }

      if (product?.sizes?.length) {
        const minSize = product.sizes.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
        if (minSize?.price != null) return `₹${Number(minSize.price).toLocaleString("en-IN")}`;
      }
    } catch {
      // ignore parse errors
    }
    return "Select size/weight";
  }, [product, selectedWeight, selectedSize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div
          className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)" }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>Product not found</h2>
          <Link to="/" className="text-pink-600 hover:underline">
            Go back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Top bar */}
        <div className="px-4 sm:px-6 lg:px-8 pt-6">
          <nav className="mb-5">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm" style={{ color: "oklch(55% .02 340)" }}>
              <li>
                <Link to="/" className="hover:underline" style={{ color: "oklch(40% .02 340)" }}>
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link to="/categories" className="hover:underline" style={{ color: "oklch(40% .02 340)" }}>
                  Shop
                </Link>
              </li>
              {product.categories && product.categories.length > 0 ? (
                <>
                  <li>/</li>
                  <li>
                    <Link to={`/category/${product.categories[0].slug}`} className="hover:underline" style={{ color: "oklch(40% .02 340)" }}>
                      {product.categories[0].name}
                    </Link>
                  </li>
                </>
              ) : product.category ? (
                <>
                  <li>/</li>
                  <li>
                    <Link to={`/category/${product.category.slug}`} className="hover:underline" style={{ color: "oklch(40% .02 340)" }}>
                      {product.category.name}
                    </Link>
                  </li>
                </>
              ) : null}
              <li>/</li>
              <li className="font-semibold" style={{ color: "oklch(20% .02 340)" }}>
                {product.name}
              </li>
            </ol>
          </nav>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pb-28 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left: Media gallery */}
            <section className="lg:col-span-7">
              <div className="lg:flex lg:gap-4">
                {/* Thumbnails (desktop vertical) */}
                {media.length > 1 ? (
                  <div className="hidden lg:flex flex-col gap-3 w-20 shrink-0">
                    {media.slice(0, 8).map((item, idx) => {
                      const active = idx === activeImageIndex;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          onMouseEnter={() => setActiveImageIndex(idx)}
                          className={[
                            "relative rounded-xl overflow-hidden border transition-transform duration-200",
                            active ? "ring-2 ring-offset-2" : "hover:scale-[1.02]",
                          ].join(" ")}
                          style={{
                            borderColor: active ? "oklch(88% .06 340)" : "oklch(92% .04 340)",
                            ringColor: "oklch(88% .06 340)",
                          }}
                        >
                          <div className="aspect-square" style={{ backgroundColor: "var(--card-white)" }}>
                            {item.type === "instagram" ? (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                              </div>
                            ) : item.type === "video" ? (
                              <video
                                src={item.url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={item.url}
                                alt={`${product.name} ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                width={96}
                                height={96}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* Primary image, video, or Instagram embed */}
                <div className="flex-1">
                  <div className="relative rounded-3xl overflow-hidden border" style={{ backgroundColor: "var(--card-white)", borderColor: "var(--border)" }}>
                    <div className="relative w-full" style={{ paddingBottom: activeMedia?.type === "instagram" ? "125%" : activeMedia?.type === "video" ? "56.25%" : "100%" }}>
                      {activeMedia?.type === "instagram" ? (
                        <div 
                          ref={instagramEmbedRef}
                          className="absolute inset-0 w-full h-full overflow-auto bg-gray-50 flex items-center justify-center p-4"
                          dangerouslySetInnerHTML={{
                            __html: `
                              <blockquote 
                                class="instagram-media" 
                                data-instgrm-permalink="${activeInstagram}/?utm_source=ig_embed&utm_campaign=loading" 
                                data-instgrm-version="14"
                                style="
                                  background:#FFF; 
                                  border:0; 
                                  border-radius:3px; 
                                  box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); 
                                  margin: 1px auto; 
                                  max-width:540px; 
                                  min-width:326px; 
                                  padding:0; 
                                  width:99.375%;
                                "
                              ></blockquote>
                            `
                          }}
                        />
                      ) : activeMedia?.type === "video" ? (
                        <video
                          src={activeMedia.url}
                          className="absolute inset-0 w-full h-full object-contain bg-black"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : activeImage ? (
                        <img
                          src={activeImage}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          decoding="async"
                          loading="eager"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "oklch(92% .04 340)" }}>
                          <img src="/logo.png" alt="Gift Choice Logo" className="w-24 h-24 object-contain opacity-50" />
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                        {product.isReady60Min ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-white/90 shadow" style={{ color: "oklch(20% .02 340)" }}>
                            60 Min
                          </span>
                        ) : null}
                        {product.isFestival ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-white/90 shadow" style={{ color: "oklch(20% .02 340)" }}>
                            Festival
                          </span>
                        ) : null}
                        {product.isNew ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-white/90 shadow" style={{ color: "oklch(20% .02 340)" }}>
                            New
                          </span>
                        ) : null}
                        {product.badge ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-pink-500 text-white shadow">
                            {product.badge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Thumbnails (mobile horizontal) */}
                  {media.length > 1 ? (
                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 lg:hidden" style={{ WebkitOverflowScrolling: "touch" }}>
                      {media.slice(0, 10).map((item, idx) => {
                        const active = idx === activeImageIndex;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveImageIndex(idx)}
                            className={[
                              "shrink-0 w-20 rounded-2xl overflow-hidden border transition-transform duration-200",
                              active ? "ring-2 ring-offset-2" : "active:scale-95",
                            ].join(" ")}
                            style={{ borderColor: "oklch(92% .04 340)" }}
                          >
                            <div className="aspect-square" style={{ backgroundColor: "var(--card-white)" }}>
                              {item.type === "video" ? (
                                <video
                                  src={item.url}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={item.url}
                                  alt={`${product.name} ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  width={96}
                                  height={96}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Right: Sticky buy box */}
            <aside className="lg:col-span-5">
              <div className="lg:sticky lg:top-6">
                <div className="rounded-3xl border p-6 shadow-sm" style={{ backgroundColor: "var(--card-white)", borderColor: "var(--border)" }}>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "oklch(20% .02 340)" }}>
                    {product.name}
                  </h1>

                  {/* Price once at top: current, struck MRP, discount */}
                  <div className="mt-4 flex flex-wrap items-baseline gap-2">
                    {(() => {
                      let selling = null;
                      let mrp = null;
                      if (selectedWeight && product?.weightOptions) {
                        try {
                          const weightOpts = Array.isArray(product.weightOptions) ? product.weightOptions : JSON.parse(product.weightOptions);
                          const w = weightOpts.find((x) => x.weight === selectedWeight);
                          if (w) {
                            selling = Number(w.price);
                            mrp = w.originalPrice != null && w.originalPrice !== "" ? Number(w.originalPrice) : null;
                          }
                        } catch { /* weightOptions parse */ }
                      } else if (selectedSize) {
                        selling = Number(selectedSize.price);
                        mrp = selectedSize.originalPrice != null && selectedSize.originalPrice !== "" ? Number(selectedSize.originalPrice) : (product?.hasSinglePrice ? (product?.originalPrice != null ? Number(product.originalPrice) : null) : null);
                      } else if (product?.hasSinglePrice && product?.singlePrice != null) {
                        selling = Number(product.singlePrice);
                        mrp = product.originalPrice != null && product.originalPrice !== "" ? Number(product.originalPrice) : null;
                      } else if (product?.sizes?.length) {
                        const minSize = product.sizes.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
                        selling = Number(minSize.price);
                        mrp = minSize.originalPrice != null && minSize.originalPrice !== "" ? Number(minSize.originalPrice) : null;
                      }
                      if (selling == null) return <span className="text-sm text-design-muted">Select size to see price</span>;
                      const showFrom = product?.sizes?.length && !selectedSize;
                      const discountPct = mrp != null && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : 0;
                      return (
                        <>
                          <span className="text-xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                            {showFrom ? "From " : ""}₹{selling.toLocaleString("en-IN")}
                          </span>
                          {mrp != null && mrp > selling && (
                            <>
                              <span className="text-base line-through text-design-muted">
                                ₹{mrp.toLocaleString("en-IN")}
                              </span>
                              <span className="text-sm font-semibold" style={{ color: "var(--success)" }}>
                                {discountPct}% OFF
                              </span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>


                  {/* Weight selector - compact label-only buttons */}
                  {product?.weightOptions ? (
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-design-foreground mb-2.5">Select weight</p>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {(() => {
                          try {
                            const weightOpts = Array.isArray(product.weightOptions) ? product.weightOptions : JSON.parse(product.weightOptions);
                            return weightOpts.map((weightOpt) => {
                              const active = selectedWeight === weightOpt.weight;
                              return (
                                <button
                                  key={weightOpt.weight}
                                  type="button"
                                  aria-pressed={active}
                                  aria-label={`Weight ${weightOpt.weight}`}
                                  onClick={() => setSelectedWeight(weightOpt.weight)}
                                  className="min-h-[36px] rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                                  style={
                                    active
                                      ? { borderColor: "var(--foreground)", borderWidth: "1.5px", backgroundColor: "var(--muted)", color: "var(--foreground)" }
                                      : { borderColor: "var(--border)", backgroundColor: "var(--card)" }
                                  }
                                >
                                  {weightOpt.weight}
                                </button>
                              );
                            });
                          } catch {
                            return <div className="text-sm text-destructive col-span-full">Error loading weight options</div>;
                          }
                        })()}
                      </div>
                    </div>
                  ) : product.hasSinglePrice ? (
                    <div className="mt-6 rounded-2xl border px-4 py-3" style={{ borderColor: "oklch(92% .04 340)" }}>
                      <div className="text-sm font-semibold" style={{ color: "oklch(55% .02 340)" }}>
                        Price
                      </div>
                      <div className="flex flex-wrap items-baseline gap-2 mt-1">
                        <span className="text-lg font-extrabold" style={{ color: "oklch(20% .02 340)" }}>
                          ₹{Number(product.singlePrice).toLocaleString("en-IN")}
                        </span>
                        {product.originalPrice != null && Number(product.originalPrice) > Number(product.singlePrice) && (
                          <>
                            <span className="text-sm line-through" style={{ color: "oklch(55% .02 340)" }}>
                              ₹{Number(product.originalPrice).toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs font-semibold text-green-600">
                              {Math.round(((product.originalPrice - product.singlePrice) / product.originalPrice) * 100)}% OFF
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : product.sizes?.length ? (
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-design-foreground mb-2.5">Select size</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {product.sizes.map((size) => {
                          const active = selectedSize?.id === size.id;
                          const outOfStock = Math.max(0, Number(size.stock ?? 0)) <= 0;
                          return (
                            <button
                              key={size.id}
                              type="button"
                              aria-pressed={active}
                              aria-label={`Size ${size.label}${outOfStock ? ", out of stock" : ""}`}
                              disabled={outOfStock}
                              onClick={() => !outOfStock && setSelectedSize(size)}
                              className={`min-h-[36px] rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200 min-w-0 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${outOfStock ? "line-through" : ""}`}
                              style={
                                active
                                  ? { borderColor: "var(--foreground)", borderWidth: "1.5px", backgroundColor: "var(--muted)", color: "var(--foreground)" }
                                  : outOfStock
                                    ? { borderColor: "var(--border)", backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
                                    : { borderColor: "var(--border)", backgroundColor: "var(--card)" }
                              }
                            >
                              {size.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "oklch(92% .04 340)", color: "oklch(55% .02 340)" }}>
                      Weights or sizes are not available for this product.
                    </div>
                  )}

                  {/* Stock status */}
                  {outOfStock && (
                    <div className="mt-6 rounded-2xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--destructive)", color: "var(--destructive)", backgroundColor: "var(--secondary)" }}>
                      Out of Stock
                    </div>
                  )}
                  {lowStock && !outOfStock && (
                    <div className="mt-6 text-sm font-medium" style={{ color: "var(--accent)" }}>
                      Only {stock} left in stock
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="mt-6">
                    <div className="text-sm font-bold" style={{ color: "oklch(20% .02 340)" }}>
                      Quantity
                    </div>
                    <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border px-3 py-2" style={{ borderColor: "oklch(92% .04 340)" }}>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={outOfStock}
                        className="w-9 h-9 rounded-xl border font-black disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
                      >
                        −
                      </button>
                      <div className="w-10 text-center text-lg font-extrabold" style={{ color: "oklch(20% .02 340)" }}>
                        {quantity}
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                        disabled={outOfStock || quantity >= maxQty}
                        className="w-9 h-9 rounded-xl border font-black disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  {(selectedWeight || selectedSize) ? (
                    <div className="mt-6 rounded-2xl border px-4 py-4" style={{ borderColor: "oklch(92% .04 340)" }}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold" style={{ color: "oklch(55% .02 340)" }}>
                          Total
                        </div>
                        <div className="text-xl font-extrabold" style={{ color: "oklch(20% .02 340)" }}>
                          ₹{selectedWeight
                            ? (() => {
                                try {
                                  const weightOpts = Array.isArray(product.weightOptions) ? product.weightOptions : JSON.parse(product.weightOptions);
                                  const w = weightOpts.find((o) => o.weight === selectedWeight);
                                  return w ? (Number(w.price) * quantity).toFixed(0) : "0";
                                } catch { return "0"; }
                              })()
                            : (Number(selectedSize.price) * quantity).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Wishlist toggle */}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    disabled={isWishlistToggling}
                    className="mt-4 w-full py-2.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 border wishlist-heart-btn disabled:opacity-60"
                    style={{
                      borderColor: "var(--border)",
                      color: isWishlisted ? "var(--destructive)" : "var(--foreground)",
                      backgroundColor: "var(--secondary)",
                    }}
                  >
                    {isWishlisted ? (
                      <svg className="w-5 h-5 wishlist-heart-filled" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 wishlist-heart-outline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                    {isWishlisted ? "Saved to wishlist" : "Add to wishlist"}
                  </button>

                  {/* CTAs */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={handleAddToCart}
                      disabled={outOfStock || (!selectedWeight && !selectedSize && !(product?.hasSinglePrice && product?.singlePrice))}
                      className="w-full py-3 rounded-2xl font-bold transition-transform duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
                    >
                      {outOfStock ? "Out of stock" : "Add to cart"}
                    </button>
                    <button
                      onClick={() => {
                        if (outOfStock) {
                          toast.error("This product is out of stock");
                          return;
                        }
                        if (!selectedWeight && !selectedSize && !(product?.hasSinglePrice && product?.singlePrice)) {
                          toast.error("Please select a weight or size");
                          return;
                        }
                        handleAddToCart();
                        navigate("/checkout");
                      }}
                      disabled={outOfStock || (!selectedWeight && !selectedSize && !(product?.hasSinglePrice && product?.singlePrice))}
                      className="w-full py-3 rounded-2xl font-bold transition-transform duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "oklch(55% .18 145)", color: "white" }}
                    >
                      Checkout
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="mt-4 w-full text-sm font-semibold underline"
                    style={{ color: "oklch(40% .02 340)" }}
                  >
                    Continue shopping
                  </button>
                </div>

                {/* Accordions */}
                <div className="mt-4 rounded-3xl border overflow-hidden" style={{ backgroundColor: "var(--card-white)", borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => toggleSection("details")}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="font-bold" style={{ color: "oklch(20% .02 340)" }}>
                      Product details
                    </div>
                    <div className="text-xl font-black" style={{ color: "oklch(40% .02 340)" }}>
                      {expanded.has("details") ? "−" : "+"}
                    </div>
                  </button>
                  {expanded.has("details") ? (
                    <div className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "oklch(55% .02 340)" }}>
                      {product.description}
                    </div>
                  ) : null}

                  <div className="h-px" style={{ backgroundColor: "oklch(92% .04 340)" }} />

                  
                </div>
              </div>
            </aside>
          </div>

          {/* Reviews Section */}
          <section className="mt-12 px-4 sm:px-6 lg:px-8" aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="text-xl font-bold font-display mb-6" style={{ color: "var(--foreground)" }}>
              Reviews
            </h2>

            {reviewsLoading ? (
              <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
                  <div className="h-5 w-20 rounded animate-pulse" style={{ background: "var(--muted)" }} />
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ borderColor: "var(--border)" }}>
                      <div className="h-4 w-32 rounded mb-2" style={{ background: "var(--muted)" }} />
                      <div className="h-3 w-full rounded" style={{ background: "var(--muted)" }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <StarRating value={reviewsData.averageRating} readonly size="lg" />
                    <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                      {reviewsData.averageRating > 0 ? reviewsData.averageRating.toFixed(1) : "—"}
                    </span>
                  </div>
                  <span className="text-sm text-muted">
                    {reviewsData.totalReviews === 0
                      ? "No reviews yet"
                      : `${reviewsData.totalReviews} ${reviewsData.totalReviews === 1 ? "review" : "reviews"}`}
                  </span>
                </div>

                {reviewsData.reviews.length === 0 ? (
                  <div
                    className="rounded-2xl border-2 border-dashed p-8 m-4 text-center"
                    style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
                  >
                    <p className="text-sm text-muted">
                      No reviews yet. Be the first to share your experience!
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-4 mb-8">
                    {reviewsData.reviews.map((rev) => (
                      <li
                        key={rev.id}
                        className="rounded-xl border p-4 transition-shadow"
                        style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "var(--shadow-soft)" }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                            {rev.userName || "Anonymous"}
                          </span>
                          <StarRating value={rev.rating} readonly size="sm" />
                        </div>
                        {rev.comment ? (
                          <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--foreground)" }}>
                            {rev.comment}
                          </p>
                        ) : null}
                        <p className="text-xs mt-2 text-muted">
                          {typeof rev.createdAt === "string"
                            ? new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add review: show form if eligible, else friendly message */}
                <div
                  className="rounded-2xl border p-6"
                  style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
                >
                  {!isAuthenticated ? (
                    <p className="text-sm text-muted">
                      <button
                        type="button"
                        onClick={() => navigate("/login", { state: { from: `/product/${product?.id}` } })}
                        className="font-semibold underline hover:no-underline"
                        style={{ color: "var(--primary)" }}
                      >
                        Log in
                      </button>{" "}
                      to leave a review.
                    </p>
                  ) : eligibilityLoading ? (
                    <div className="h-10 w-48 rounded animate-pulse" style={{ background: "var(--muted)" }} />
                  ) : eligibility?.existingReview ? (
                    <p className="text-sm text-muted">
                      You&apos;ve already reviewed this product. Thank you!
                    </p>
                  ) : eligibility?.canReview ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                          Your rating
                        </p>
                        <StarRating value={reviewRating} onChange={setReviewRating} size="lg" />
                      </div>
                      <div>
                        <label htmlFor="review-comment" className="text-sm font-semibold block mb-2" style={{ color: "var(--foreground)" }}>
                          Comment (optional)
                        </label>
                        <textarea
                          id="review-comment"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Share your experience..."
                          rows={3}
                          className="w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", background: "var(--background)" }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmitReview}
                        disabled={submitReviewLoading || reviewRating < 1}
                        className="px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-60 btn-primary-brand"
                        style={{ borderRadius: "var(--radius-lg)" }}
                      >
                        {submitReviewLoading ? "Submitting…" : "Submit review"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      Purchase this product to leave a review.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Similar Products Section */}
          {similarProducts.length > 0 && (
            <section className="mt-16 px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl sm:text-xl font-extrabold mb-6" style={{ color: "oklch(20% .02 340)" }}>
                Similar Products
              </h2>
              {similarProducts.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {similarProducts.map((similarProduct) => (
                    <ProductCard key={similarProduct.id} product={similarProduct} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recently Viewed */}
          {recentIds.length > 0 && (
            <ProductCarouselSection
              title="Recently Viewed"
              productIds={recentIds}
              excludeProductId={product?.id}
            />
          )}

          {/* Recommended for You */}
          <RecommendationCarousel
            products={recommendedProducts}
            isLoading={loadingRecommendations}
            title="Recommended for You"
          />
        </div>

        {/* Mobile sticky add-to-cart */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" aria-label="Sticky add to cart">
          <div
            className="border-t"
            style={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
              boxShadow: "0 -8px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold" style={{ color: "var(--foreground-muted)" }}>
                  {outOfStock ? "Out of stock" : stickyCanAdd ? "Ready to add" : "Select options"}
                </div>
                <div
                  className="text-base font-extrabold truncate"
                  style={{ color: "var(--foreground)" }}
                >
                  {outOfStock ? "—" : stickyPriceText}
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={!stickyCanAdd}
                className="min-w-[150px] px-5 py-3 rounded-2xl font-bold transition-transform duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "oklch(55% .18 145)", color: "white" }}
              >
                {outOfStock ? "Out of stock" : "Add to cart"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
