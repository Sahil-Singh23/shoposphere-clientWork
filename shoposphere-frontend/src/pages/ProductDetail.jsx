import { useEffect, useMemo, useState } from "react";
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
import {
  deriveSizeOptionsFromVariants,
  discountPercent,
  findWeightOption,
  firstProductImageUrl,
  formatInr,
  getMinPriceForProduct,
  getPrimaryCategory,
  normalizeImageList,
  parseInstagramEmbedsList,
  parseWeightOptions,
  parseWeightOptionsSafe,
  pickPreferredSize,
  resolveDisplayedPricing,
} from "../utils/productDetailHelpers";

const INSTAGRAM_GLYPH_PATH =
  "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z";

function InstagramGlyph({ className = "w-10 h-10" }) {
  return (
    <svg className={`${className} text-white`} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d={INSTAGRAM_GLYPH_PATH} />
    </svg>
  );
}

function MediaThumbPreview({ item, productName, index, iconSizeClass }) {
  return (
    <div className="w-full h-full bg-[#f3f3f5]">
      {item.type === "instagram" ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
          <InstagramGlyph className={iconSizeClass} />
        </div>
      ) : item.type === "video" ? (
        <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
      ) : (
        <img
          src={item.url}
          alt={`${productName} ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          width={96}
          height={96}
        />
      )}
    </div>
  );
}

function ProductMediaThumbnails({
  media,
  maxItems,
  activeIndex,
  onPick,
  productName,
  layout,
}) {
  const items = media.slice(0, maxItems);
  if (items.length === 0) return null;

  const wrapperClass =
    layout === "sidebar"
      ? "order-2 md:order-1 flex md:flex-col gap-3 md:gap-4 overflow-x-auto md:overflow-y-auto md:max-h-[min(85vh,920px)] hide-scrollbar-pdp shrink-0 pb-1 md:pb-0"
      : "mt-4 flex gap-3 overflow-x-auto pb-2 lg:hidden hide-scrollbar-pdp";

  const buttonClass =
    layout === "sidebar"
      ? "relative w-20 h-24 md:w-24 md:h-32 shrink-0 rounded-xl overflow-hidden transition-all duration-200"
      : "shrink-0 w-20 h-24 rounded-xl overflow-hidden transition-all duration-200";

  const activeRing =
    layout === "sidebar"
      ? "ring-2 ring-offset-2 ring-black border-2 border-black"
      : "ring-2 ring-offset-2 ring-black border-2 border-black";

  const idleRing =
    layout === "sidebar"
      ? "border border-black/10 hover:opacity-80"
      : "border border-black/10 active:scale-95";

  return (
    <div className={wrapperClass} style={layout === "strip" ? { WebkitOverflowScrolling: "touch" } : undefined}>
      {items.map((item, idx) => {
        const active = idx === activeIndex;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onPick(idx)}
            onMouseEnter={layout === "sidebar" ? () => onPick(idx) : undefined}
            className={`${buttonClass} ${active ? activeRing : idleRing}`}
          >
            <MediaThumbPreview
              item={item}
              productName={productName}
              index={idx}
              iconSizeClass={layout === "sidebar" ? "w-10 h-10" : "w-8 h-8"}
            />
          </button>
        );
      })}
    </div>
  );
}

function ProductBadges({ product }) {
  return (
    <div className="absolute top-4 left-4 flex flex-wrap gap-2">
      {product.isReady60Min ? (
        <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/95 text-black shadow-sm border border-black/5">
          60 Min
        </span>
      ) : null}
      {product.isFestival ? (
        <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/95 text-black shadow-sm border border-black/5">
          Festival
        </span>
      ) : null}
      {product.isNew ? (
        <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-black text-white shadow-sm">
          New
        </span>
      ) : null}
      {product.badge ? (
        <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-black text-white shadow-sm">
          {product.badge}
        </span>
      ) : null}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist, togglingId } = useWishlist();
  const { recentIds, addViewed } = useRecentlyViewed();
  const { isAuthenticated } = useUserAuth();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
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

  const primaryCategory = useMemo(() => getPrimaryCategory(product), [product]);

  const colorOptions = useMemo(() => {
    if (!Array.isArray(product?.colors)) return [];
    return [...product.colors].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }, [product?.colors]);

  const selectedColor = useMemo(() => {
    if (!selectedColorId) return null;
    return colorOptions.find((c) => c.id === selectedColorId) || null;
  }, [colorOptions, selectedColorId]);

  const sizeOptions = useMemo(() => {
    if (Array.isArray(product?.variants) && product.variants.length > 0) {
      const pool = selectedColorId ? product.variants.filter((v) => v.colorId === selectedColorId) : product.variants;
      return deriveSizeOptionsFromVariants(pool);
    }
    return Array.isArray(product?.sizes) ? product.sizes : [];
  }, [product?.variants, product?.sizes, selectedColorId]);

  const images = useMemo(() => normalizeImageList(product?.images), [product?.images]);

  const selectedColorImages = useMemo(() => {
    const colorPhotoUrls = Array.isArray(selectedColor?.photoUrls)
      ? selectedColor.photoUrls.filter(Boolean)
      : selectedColor?.photoUrl
        ? [selectedColor.photoUrl]
        : [];

    if (!colorPhotoUrls.length) return images;

    const deduped = [];
    const seen = new Set();
    for (const url of colorPhotoUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        deduped.push(url);
      }
    }
    return deduped;
  }, [images, selectedColor?.photoUrl, selectedColor?.photoUrls]);

  const videos = useMemo(() => {
    if (!product?.videos || !Array.isArray(product.videos)) return [];
    return product.videos;
  }, [product?.videos]);

  const instagramEmbeds = useMemo(
    () => parseInstagramEmbedsList(product?.instagramEmbeds),
    [product?.instagramEmbeds]
  );

  const media = useMemo(() => {
    const imgItems = selectedColorImages.map((url) => ({ type: "image", url }));
    const vidItems = videos.map((url) => ({ type: "video", url }));
    const instaItems = instagramEmbeds.map((embed) => ({ type: "instagram", url: embed.url }));
    return [...imgItems, ...vidItems, ...instaItems];
  }, [selectedColorImages, videos, instagramEmbeds]);

  const activeMedia = media[activeMediaIndex] || media[0] || null;
  const activeImageUrl = activeMedia?.type === "image" ? activeMedia.url : null;
  const activeInstagramUrl = activeMedia?.type === "instagram" ? activeMedia.url : null;

  const weightOptionsParsed = useMemo(() => parseWeightOptionsSafe(product), [product]);

  const resolvedPricing = useMemo(
    () => resolveDisplayedPricing(product, selectedWeight, selectedSize, sizeOptions),
    [product, selectedWeight, selectedSize, sizeOptions]
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(`${API}/products/${id}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        setProduct(data);
        if (data?.id) addViewed(data.id);

        const initialColorId = Array.isArray(data?.colors) && data.colors.length > 0 ? data.colors[0].id : null;
        setSelectedColorId(initialColorId);

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
        } else if (data?.hasSinglePrice && data.singlePrice) {
          setSelectedSize({
            id: 0,
            label: "Standard",
            price: parseFloat(data.singlePrice),
            originalPrice:
              data.originalPrice != null && data.originalPrice !== "" ? parseFloat(data.originalPrice) : null,
          });
        } else {
          let nextSizes = [];
          if (Array.isArray(data?.variants) && data.variants.length > 0) {
            const variantPool = initialColorId ? data.variants.filter((v) => v.colorId === initialColorId) : data.variants;
            nextSizes = deriveSizeOptionsFromVariants(variantPool);
          } else if (data?.sizes && data.sizes.length > 0) {
            nextSizes = data.sizes;
          }
          setSelectedSize(pickPreferredSize(nextSizes));
        }
        setQuantity(1);
        setActiveMediaIndex(0);
        setLoading(false);

        if (data?.instagramEmbeds?.length > 0) {
          setTimeout(() => initializeInstagramEmbeds(), 300);
        }

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

        const firstCategory = data?.categories && data.categories.length > 0 ? data.categories[0] : data?.category;
        if (firstCategory?.slug) {
          fetch(`${API}/products?category=${firstCategory.slug}&limit=10`, { signal: ac.signal })
            .then((res) => res.json())
            .then((products) => {
              const similar = Array.isArray(products) ? products.filter((p) => p.id !== Number(id)) : [];
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
  }, [id, addViewed]);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [selectedColorId]);

  useEffect(() => {
    if (activeMediaIndex >= media.length) {
      setActiveMediaIndex(0);
    }
  }, [activeMediaIndex, media.length]);

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

  useEffect(() => {
    if (!id || !isAuthenticated) {
      setEligibility(null);
      return;
    }
    const ac = new AbortController();
    setEligibilityLoading(true);
    fetch(`${API}/reviews/eligibility/${id}`, { credentials: "include", signal: ac.signal })
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
  }, [id, isAuthenticated]);

  const handleSubmitReview = async () => {
    if (!product?.id || reviewRating < 1 || reviewRating > 5) {
      toast.error("Please select a rating (1–5 stars)");
      return;
    }
    setSubmitReviewLoading(true);
    try {
      const res = await fetch(`${API}/reviews/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEligibility((prev) =>
          prev
            ? {
                ...prev,
                canReview: false,
                existingReview: {
                  id: data.id,
                  rating: data.rating,
                  comment: data.comment,
                  createdAt: data.createdAt,
                },
              }
            : null
        );
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

  const stock = useMemo(() => {
    if (!product) return 0;
    if (selectedWeight && product.weightOptions) {
      const opts = parseWeightOptions(product);
      const w = findWeightOption(opts, selectedWeight);
      if (w) return Math.max(0, Number(w.stock ?? product.stock ?? 0));
      return 0;
    }
    if (selectedSize && selectedSize.id !== 0) {
      if (typeof selectedSize.stock === "number") return Math.max(0, selectedSize.stock);
      const s = product.sizes?.find((sz) => sz.id === selectedSize.id);
      if (s && typeof s.stock === "number") return Math.max(0, s.stock);
    }
    return Math.max(0, typeof product.stock === "number" ? product.stock : 0);
  }, [product, selectedWeight, selectedSize]);

  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;
  const maxQty = Math.max(1, stock);

  const hasSinglePriceSelection = Boolean(product?.hasSinglePrice && product?.singlePrice);
  const hasSizeOrWeightSelection = Boolean(selectedWeight || selectedSize);
  const canSelectForCart = hasSizeOrWeightSelection || hasSinglePriceSelection;

  const handleAddToCart = () => {
    if (outOfStock) {
      toast.error("This product is out of stock");
      return;
    }
    if (selectedWeight) {
      addToCart(product, null, Math.min(quantity, maxQty), selectedWeight);
      return;
    }
    if (!selectedSize && !hasSinglePriceSelection) {
      toast.error("Please select a size or weight");
      return;
    }
    addToCart(product, selectedSize, Math.min(quantity, maxQty));
  };

  const handleBuyNow = () => {
    if (outOfStock) {
      toast.error("This product is out of stock");
      return;
    }
    if (!selectedWeight && !selectedSize && !hasSinglePriceSelection) {
      toast.error("Please select a weight or size");
      return;
    }
    handleAddToCart();
    navigate("/checkout");
  };

  const stickyCanAdd = useMemo(() => {
    if (!product) return false;
    return !outOfStock && canSelectForCart;
  }, [product, outOfStock, canSelectForCart]);

  const stickyPriceText = useMemo(() => {
    if (!product) return "Select size/weight";
    if (resolvedPricing.selling != null) return formatInr(resolvedPricing.selling);
    return "Select size/weight";
  }, [product, resolvedPricing.selling]);

  const narrativeParagraphs = useMemo(() => {
    const text = (product?.description || "").trim();
    if (!text) return [];
    const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts : [text];
  }, [product?.description]);

  const specRows = useMemo(() => {
    if (!product) return [];
    const rows = [];
    const cat = product.categories?.[0]?.name || product.category?.name;
    if (cat) rows.push({ label: "Category", value: cat });
    rows.push({
      label: "Availability",
      value: stock <= 0 ? "Out of stock" : `${stock} available`,
    });
    const variant = Array.isArray(product.variants)
      ? product.variants.find((x) => x.id === selectedSize?.id)
      : null;
    if (variant?.sku) rows.push({ label: "SKU", value: variant.sku });
    if (selectedWeight) rows.push({ label: "Weight / pack", value: String(selectedWeight) });
    return rows;
  }, [product, stock, selectedSize, selectedWeight]);

  const completeSetItems = useMemo(() => {
    const rec = recommendedProducts.slice(0, 2);
    if (rec.length >= 2) return rec;
    const sim = similarProducts.filter((p) => !rec.some((r) => r.id === p.id));
    return [...rec, ...sim].slice(0, 2);
  }, [recommendedProducts, similarProducts]);

  const completeSetTotal = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const p of completeSetItems) {
      const n = getMinPriceForProduct(p);
      if (n != null) {
        sum += n;
        any = true;
      }
    }
    return any ? sum : null;
  }, [completeSetItems]);

  const lineTotalDisplay = useMemo(() => {
    if (!selectedWeight && !selectedSize) return null;
    if (selectedWeight) {
      const opts = parseWeightOptions(product);
      const w = findWeightOption(opts, selectedWeight);
      return w ? (Number(w.price) * quantity).toLocaleString("en-IN") : "0";
    }
    return (Number(selectedSize.price) * quantity).toLocaleString("en-IN");
  }, [product, selectedWeight, selectedSize, quantity]);

  const priceBlock = useMemo(() => {
    const { selling, mrp, showFrom } = resolvedPricing;
    if (selling == null) {
      return <span className="text-sm font-medium text-[#474747]">Select options to see price</span>;
    }
    const pct = discountPercent(mrp, selling);
    return (
      <div className="flex flex-wrap items-baseline gap-3 py-2">
        <span className="pd-headline text-3xl sm:text-4xl font-black text-[#1a1c1d] tracking-tight">
          {showFrom ? "From " : ""}₹{selling.toLocaleString("en-IN")}
        </span>
        {mrp != null && mrp > selling && (
          <>
            <span className="text-lg line-through text-[#474747]/80">₹{mrp.toLocaleString("en-IN")}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">{pct}% off</span>
          </>
        )}
      </div>
    );
  }, [resolvedPricing]);

  const collectionLabel = (primaryCategory?.name || "Collection").toUpperCase();

  const handleColorPick = (color) => {
    const filteredVariants = Array.isArray(product?.variants)
      ? product.variants.filter((v) => v.colorId === color.id)
      : [];
    const nextSizes = deriveSizeOptionsFromVariants(filteredVariants);
    setSelectedColorId(color.id);
    if (nextSizes.length > 0) {
      setSelectedSize(pickPreferredSize(nextSizes));
      setSelectedWeight(null);
    } else if (!(product?.hasSinglePrice && product?.singlePrice)) {
      setSelectedSize(null);
    }
    setQuantity(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pd-editorial bg-[#f9f9fb]">
        <div
          className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent border-black/20"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center pd-editorial bg-[#f9f9fb]">
        <div className="text-center px-4">
          <h2 className="pd-headline text-xl font-black uppercase tracking-tight mb-4 text-[#1a1c1d]">Product not found</h2>
          <Link to="/" className="text-sm font-semibold text-[#474747] underline underline-offset-4 hover:text-black">
            Back to Shoposphere
          </Link>
        </div>
      </div>
    );
  }

  const mainAspectPadding =
    activeMedia?.type === "instagram" ? "125%" : activeMedia?.type === "video" ? "56.25%" : "125%";

  return (
    <>
      <div className="min-h-screen pd-editorial bg-[#f9f9fb] text-[#1a1c1d]">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
            <nav className="mb-8 sm:mb-10" aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-medium uppercase tracking-[0.2em] text-[#474747]/70">
                <li>
                  <Link to="/categories" className="hover:text-[#1a1c1d] transition-colors">
                    Shop
                  </Link>
                </li>
                <li aria-hidden className="text-[10px] opacity-60">
                  ›
                </li>
                {primaryCategory ? (
                  <>
                    <li>
                      <Link
                        to={`/category/${primaryCategory.slug}`}
                        className="hover:text-[#1a1c1d] transition-colors"
                      >
                        {primaryCategory.name}
                      </Link>
                    </li>
                    <li aria-hidden className="text-[10px] opacity-60">
                      ›
                    </li>
                  </>
                ) : null}
                <li className="font-bold text-black tracking-normal normal-case max-w-[min(100%,16rem)] sm:max-w-xl truncate">
                  {product.name}
                </li>
              </ol>
            </nav>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 pb-28 lg:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <section className="lg:col-span-7">
                <div className="flex flex-col md:flex-row gap-4">
                  {media.length > 0 ? (
                    <ProductMediaThumbnails
                      media={media}
                      maxItems={8}
                      activeIndex={activeMediaIndex}
                      onPick={setActiveMediaIndex}
                      productName={product.name}
                      layout="sidebar"
                    />
                  ) : null}

                  <div className="order-1 md:order-2 flex-1 min-w-0">
                    <div className="relative rounded-2xl overflow-hidden bg-[#f3f3f5] editorial-pdp-shadow border border-black/[0.06]">
                      <div className="relative w-full" style={{ paddingBottom: mainAspectPadding }}>
                        {activeMedia?.type === "instagram" ? (
                          <div
                            className="absolute inset-0 w-full h-full overflow-auto bg-gray-50 flex items-center justify-center p-4"
                            dangerouslySetInnerHTML={{
                              __html: `
                              <blockquote 
                                class="instagram-media" 
                                data-instgrm-permalink="${activeInstagramUrl}/?utm_source=ig_embed&utm_campaign=loading" 
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
                            `,
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
                        ) : activeImageUrl ? (
                          <img
                            src={activeImageUrl}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            decoding="async"
                            loading="eager"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#eee]">
                            <img src="/logo.png" alt="" className="w-24 h-24 object-contain opacity-40" />
                          </div>
                        )}

                        <ProductBadges product={product} />
                      </div>
                    </div>

                    {media.length > 1 ? (
                      <ProductMediaThumbnails
                        media={media}
                        maxItems={10}
                        activeIndex={activeMediaIndex}
                        onPick={setActiveMediaIndex}
                        productName={product.name}
                        layout="strip"
                      />
                    ) : null}
                  </div>
                </div>
              </section>

              <aside className="lg:col-span-5">
                <div className="lg:sticky lg:top-24 space-y-8 lg:space-y-10">
                  <div className="space-y-4">
                    <p className="text-[#474747] text-xs font-bold uppercase tracking-[0.2em]">{collectionLabel}</p>
                    <div className="flex items-start justify-between gap-4">
                      <h1 className="pd-headline text-3xl sm:text-4xl lg:text-[2.75rem] font-black uppercase tracking-tighter leading-[0.98] text-[#1a1c1d] flex-1 min-w-0">
                        {product.name}
                      </h1>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(product.id)}
                        disabled={isWishlistToggling}
                        className="shrink-0 h-11 w-11 rounded-full border border-black/10 bg-white flex items-center justify-center transition-all hover:border-black/25 disabled:opacity-50 wishlist-heart-btn"
                        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        {isWishlisted ? (
                          <svg
                            className="w-5 h-5 wishlist-heart-filled text-red-600"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 wishlist-heart-outline text-[#1a1c1d]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <StarRating value={reviewsData.averageRating} readonly size="md" />
                      <a
                        href="#product-reviews"
                        className="text-sm font-semibold text-[#474747] underline underline-offset-4 hover:text-black"
                      >
                        {reviewsData.totalReviews === 0
                          ? "Write a review"
                          : `${reviewsData.totalReviews} ${reviewsData.totalReviews === 1 ? "review" : "reviews"}`}
                      </a>
                    </div>
                    {priceBlock}
                  </div>

                  {colorOptions.length > 0 ? (
                    <div className="space-y-4" id="product-color-options">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#1a1c1d]">
                          Color: {selectedColor?.name || "Select"}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {colorOptions.map((color) => {
                          const active = selectedColorId === color.id;
                          return (
                            <button
                              key={color.id}
                              type="button"
                              title={color.name}
                              onClick={() => handleColorPick(color)}
                              className={[
                                "w-12 h-12 rounded-full p-0.5 transition-all",
                                active
                                  ? "ring-2 ring-offset-2 ring-black border-2 border-black"
                                  : "border border-[#c6c6c6] hover:border-black",
                              ].join(" ")}
                              style={{ backgroundColor: color.hexCode || "#888" }}
                              aria-pressed={active}
                              aria-label={`Color ${color.name}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {product?.weightOptions ? (
                    <div className="space-y-4" id="product-size-guide">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#1a1c1d]">Select weight</h3>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                        {!weightOptionsParsed.ok ? (
                          <div className="text-sm text-red-600 col-span-full">Error loading weight options</div>
                        ) : (
                          weightOptionsParsed.options.map((weightOpt) => {
                            const active = selectedWeight === weightOpt.weight;
                            return (
                              <button
                                key={weightOpt.weight}
                                type="button"
                                aria-pressed={active}
                                aria-label={`Weight ${weightOpt.weight}`}
                                onClick={() => setSelectedWeight(weightOpt.weight)}
                                className={[
                                  "py-3 px-2 rounded-xl text-xs font-bold transition-all",
                                  active
                                    ? "bg-black text-white"
                                    : "bg-[#e8e8ea] text-[#1a1c1d] hover:bg-black hover:text-white",
                                ].join(" ")}
                              >
                                {weightOpt.weight}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : !product.hasSinglePrice && sizeOptions.length ? (
                    <div className="space-y-4" id="product-size-guide">
                      <div className="flex justify-between items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#1a1c1d]">Select size</h3>
                        <span className="text-xs font-bold text-[#474747] underline underline-offset-4 cursor-default">
                          Size guide
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {sizeOptions.map((size) => {
                          const active = selectedSize?.id === size.id;
                          const sizeOos = Math.max(0, Number(size.stock ?? 0)) <= 0;
                          return (
                            <button
                              key={size.id}
                              type="button"
                              aria-pressed={active}
                              aria-label={`Size ${size.label}${sizeOos ? ", out of stock" : ""}`}
                              disabled={sizeOos}
                              onClick={() => !sizeOos && setSelectedSize(size)}
                              className={[
                                "py-3 px-2 rounded-xl text-sm font-bold transition-all",
                                active
                                  ? "bg-black text-white"
                                  : sizeOos
                                    ? "bg-[#eee] text-[#999] line-through cursor-not-allowed"
                                    : "bg-[#e8e8ea] text-[#1a1c1d] hover:bg-black hover:text-white",
                              ].join(" ")}
                            >
                              {size.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : !product.hasSinglePrice ? (
                    <div className="rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold text-[#474747]">
                      Options for this product are not available.
                    </div>
                  ) : null}

                  {outOfStock && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                      Out of stock
                    </div>
                  )}
                  {lowStock && !outOfStock && (
                    <p className="text-sm font-semibold text-amber-800">Only {stock} left in stock</p>
                  )}

                  <div className="bg-[#f3f3f5] p-6 sm:p-8 rounded-xl border border-black/[0.08] editorial-pdp-shadow space-y-6">
                    <div className="flex items-center gap-2 text-black font-bold">
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
                      </svg>
                      <span className="text-sm">Complimentary delivery on qualifying orders — Shoposphere</span>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#1a1c1d] mb-3">Quantity</p>
                      <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={outOfStock}
                          className="h-10 w-10 rounded-full font-bold text-lg disabled:opacity-40 hover:bg-black/5"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-lg font-black tabular-nums">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                          disabled={outOfStock || quantity >= maxQty}
                          className="h-10 w-10 rounded-full font-bold text-lg disabled:opacity-40 hover:bg-black/5"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {hasSizeOrWeightSelection ? (
                      <div className="flex items-center justify-between border-t border-black/10 pt-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#474747]">Line total</span>
                        <span className="pd-headline text-xl font-black text-[#1a1c1d]">₹{lineTotalDisplay}</span>
                      </div>
                    ) : null}

                    <div className="space-y-3 pt-2">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={outOfStock || !canSelectForCart}
                        className="w-full bg-black text-[#e2e2e2] py-4 sm:py-5 rounded-full font-bold uppercase tracking-[0.15em] text-xs sm:text-sm hover:opacity-90 transition-opacity active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {outOfStock ? "Out of stock" : "Add to cart"}
                      </button>
                      <button
                        type="button"
                        onClick={handleBuyNow}
                        disabled={outOfStock || !canSelectForCart}
                        className="w-full bg-white text-black py-4 sm:py-5 rounded-full font-bold uppercase tracking-[0.15em] text-xs sm:text-sm border border-black hover:bg-black hover:text-[#e2e2e2] transition-all active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        Buy now
                      </button>
                    </div>
                    <p className="text-center text-[10px] text-[#474747] uppercase tracking-tight">
                      Curated with care · Packed with intent — Shoposphere
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="text-sm font-bold text-[#474747] underline underline-offset-4 hover:text-black w-full text-left"
                  >
                    Continue shopping
                  </button>
                </div>
              </aside>
            </div>

            <div className="mt-20 lg:mt-28 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
              <div className="lg:col-span-8 space-y-16 lg:space-y-20">
                {narrativeParagraphs.length > 0 ? (
                  <section className="space-y-6 lg:space-y-8">
                    <h2 className="pd-headline text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#1a1c1d]">
                      Product narrative
                    </h2>
                    <div className="space-y-6 text-[#474747] leading-relaxed text-base sm:text-lg max-w-2xl">
                      {narrativeParagraphs.map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </section>
                ) : null}
                {specRows.length > 0 ? (
                  <section className="space-y-6 lg:space-y-8">
                    <h2 className="pd-headline text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#1a1c1d]">
                      Technical specifications
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 border-t border-black/10 pt-8">
                      {specRows.map((row) => (
                        <div
                          key={row.label}
                          className="flex justify-between gap-4 py-3 border-b border-black/[0.06]"
                        >
                          <span className="font-bold text-xs uppercase tracking-widest text-[#474747] shrink-0">
                            {row.label}
                          </span>
                          <span className="text-sm font-medium text-[#1a1c1d] text-right">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
              {completeSetItems.length > 0 ? (
                <div className="lg:col-span-4">
                  <div className="lg:sticky lg:top-28 space-y-6 lg:space-y-8">
                    <h3 className="pd-headline text-xl sm:text-2xl font-black uppercase tracking-tighter text-[#1a1c1d]">
                      Complete the look
                    </h3>
                    <div className="space-y-6">
                      {completeSetItems.map((p) => {
                        const img = firstProductImageUrl(p);
                        const pMin = getMinPriceForProduct(p);
                        return (
                          <Link key={p.id} to={`/product/${p.id}`} className="flex items-center gap-4 group">
                            <div className="w-20 h-20 bg-[#f3f3f5] rounded-xl overflow-hidden shrink-0 border border-black/5">
                              {img ? (
                                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : null}
                            </div>
                            <div className="flex-grow min-w-0">
                              <h4 className="text-sm font-bold uppercase tracking-tight text-[#1a1c1d] group-hover:underline truncate">
                                {p.name}
                              </h4>
                              <p className="text-sm text-[#474747]">
                                {pMin != null ? `₹${pMin.toLocaleString("en-IN")}` : "—"}
                              </p>
                            </div>
                            <span className="text-2xl text-[#1a1c1d] leading-none font-light" aria-hidden>
                              +
                            </span>
                          </Link>
                        );
                      })}
                      {completeSetTotal != null ? (
                        <div className="pt-6 border-t border-black/10">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xs uppercase font-bold tracking-widest text-[#474747]">
                              Pairing total
                            </span>
                            <span className="text-xl pd-headline font-black text-[#1a1c1d]">
                              ₹{completeSetTotal.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <a
                            href="#product-recommendations"
                            className="block w-full bg-[#d4d4d4] text-[#1a1c1d] py-4 rounded-full font-bold uppercase tracking-widest text-[10px] sm:text-xs text-center hover:bg-black hover:text-white transition-colors"
                          >
                            Browse recommendations
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <section
              id="product-reviews"
              className="mt-16 lg:mt-20 px-4 sm:px-6 lg:px-8 scroll-mt-28"
              aria-labelledby="reviews-heading"
            >
              <h2 id="reviews-heading" className="pd-headline text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#1a1c1d] mb-8">
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
                      <p className="text-sm text-muted">No reviews yet. Be the first to share your experience!</p>
                    </div>
                  ) : (
                    <ul className="space-y-4 mb-8">
                      {reviewsData.reviews.map((rev) => (
                        <li
                          key={rev.id}
                          className="rounded-xl border p-4 transition-shadow"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--background)",
                            boxShadow: "var(--shadow-soft)",
                          }}
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
                              ? new Date(rev.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

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
                      <p className="text-sm text-muted">You&apos;ve already reviewed this product. Thank you!</p>
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
                      <p className="text-sm text-muted">Purchase this product to leave a review.</p>
                    )}
                  </div>
                </>
              )}
            </section>

            {similarProducts.length > 0 ? (
              <section className="mt-16 px-4 sm:px-6 lg:px-8">
                <h2 className="pd-headline text-xl sm:text-2xl font-black uppercase tracking-tighter text-[#1a1c1d] mb-6">
                  Similar products
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {similarProducts.map((similarProduct) => (
                    <ProductCard key={similarProduct.id} product={similarProduct} />
                  ))}
                </div>
              </section>
            ) : null}

            {recentIds.length > 0 ? (
              <ProductCarouselSection
                title="Recently Viewed"
                productIds={recentIds}
                excludeProductId={product?.id}
              />
            ) : null}

            <div id="product-recommendations" className="scroll-mt-28">
              <RecommendationCarousel
                products={recommendedProducts}
                isLoading={loadingRecommendations}
                title="Recommended for you"
              />
            </div>
          </div>

          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]" aria-label="Sticky add to cart">
            <div className="border-t border-black/10 bg-[#f9f9fb]/95 backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.08)]">
              <div className="px-4 py-3 flex items-center gap-3 max-w-7xl mx-auto">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#474747]">
                    {outOfStock ? "Out of stock" : stickyCanAdd ? "Ready to add" : "Select options"}
                  </div>
                  <div className="text-base font-black truncate pd-headline text-[#1a1c1d]">
                    {outOfStock ? "—" : stickyPriceText}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!stickyCanAdd}
                  className="min-w-[148px] px-5 py-3.5 rounded-full font-bold uppercase tracking-wider text-xs bg-black text-white transition-transform active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
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
