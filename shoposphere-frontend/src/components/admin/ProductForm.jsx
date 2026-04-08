import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "../../api";
import VideoUpload from "./VideoUpload";
import InstagramEmbedInput from "./InstagramEmbedInput";
import { useToast } from "../../context/ToastContext";
import { PRODUCT_HIGHLIGHT_FIELDS } from "../../utils/productDetailHelpers";

// Treat as "edit" only when product has a valid id (duplicate passes product with id null/undefined)
const isEditProduct = (p) => p && (p.id != null && p.id !== "");
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

function emptyHighlightFormFields() {
  return {
    materialComposition: "",
    pattern: "",
    fitType: "",
    sleeveType: "",
    collarStyle: "",
    lengthDetail: "",
    countryOfOrigin: "",
  };
}

function highlightFormFieldsFromProduct(product) {
  if (!product) return emptyHighlightFormFields();
  return {
    materialComposition: product.materialComposition ?? "",
    pattern: product.pattern ?? "",
    fitType: product.fitType ?? "",
    sleeveType: product.sleeveType ?? "",
    collarStyle: product.collarStyle ?? "",
    lengthDetail: product.lengthDetail ?? "",
    countryOfOrigin: product.countryOfOrigin ?? "",
  };
}

function parseColorImageUrls(color) {
  if (!color) return [];
  if (Array.isArray(color.photoUrls)) {
    return color.photoUrls.map((u) => String(u || "").trim()).filter(Boolean);
  }
  if (typeof color.photoUrl === "string") {
    const raw = color.photoUrl.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u || "").trim()).filter(Boolean);
      }
    } catch {
      // legacy single URL value
    }
    return [raw];
  }
  return [];
}

function moveArrayItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function buildVariantGalleryOrder(existingImages = [], newImages = []) {
  const existing = existingImages.map((_, index) => ({ kind: "existing", index }));
  const fresh = newImages.map((_, index) => ({ kind: "new", index }));
  return [...existing, ...fresh];
}

export default function ProductForm({ product, categories, onSave, onCancel }) {
  const toast = useToast();
  const isEdit = isEditProduct(product);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    badge: "",
    isNew: false,
    isTrending: false,
    originalPrice: "", // MRP for single-price products
    keywords: "",
    ...emptyHighlightFormFields(),
  });
  const [productVariants, setProductVariants] = useState([]);
  const [variantMode, setVariantMode] = useState("color");
  const [existingImages, setExistingImages] = useState([]);
  const [variantImageDropActiveId, setVariantImageDropActiveId] = useState(null);
  const [variantDraggedImage, setVariantDraggedImage] = useState(null);
  const [videos, setVideos] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [instagramEmbeds, setInstagramEmbeds] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionLanguage, setDescriptionLanguage] = useState("English");
  const formRef = useRef(null);
  const variantImageInputRefs = useRef({});
  const isSubmittingRef = useRef(false);
  const initialSnapshotRef = useRef("");

  const snapshot = useMemo(() => {
    return JSON.stringify({
      formData,
      productVariants: productVariants.map((v) => ({
        colorName: v.colorName,
        colorHex: v.colorHex,
        imageCount: (v.images?.length || 0) + (v.existingImages?.length || 0),
        sizeStocks: v.sizeStocks || {},
      })),
      existingImages,
      selectedCategories,
      // For new images, treat any selection as "dirty"
      imagesSelectedCount: productVariants.reduce((sum, v) => sum + (v.images?.length || 0), 0),
    });
  }, [formData, productVariants, existingImages, selectedCategories]);

  const isDirty = initialSnapshotRef.current !== "" && snapshot !== initialSnapshotRef.current;

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price:
          Array.isArray(product.variants) && product.variants.length > 0 && product.variants[0].price != null
            ? String(product.variants[0].price)
            : product?.sizes?.[0]?.price != null
            ? String(product.sizes[0].price)
            : "",
        badge: product.badge || "",
        isNew: product.isNew || false,
        isTrending: product.isTrending || false,
        originalPrice: product.originalPrice != null ? String(product.originalPrice) : "",
        keywords: product.keywords ? (Array.isArray(product.keywords) ? product.keywords.join(", ") : product.keywords) : "",
        ...highlightFormFieldsFromProduct(product),
      });
      const colorRows = Array.isArray(product.colors) ? product.colors : [];
      const variantRows = Array.isArray(product.variants) ? product.variants : [];
      const grouped = new Map();

      for (const color of colorRows) {
        const parsedImages = parseColorImageUrls(color);
        grouped.set(`color-${color.id}`, {
          id: `color-${color.id}`,
          colorId: color.id,
          colorName: color.name || "",
          colorHex: color.hexCode || "#000000",
          images: [],
          imagePreviews: [],
          existingImages: parsedImages,
          galleryOrder: buildVariantGalleryOrder(parsedImages, []),
          sizeStocks: {},
          collapsed: false,
        });
      }

      for (const v of variantRows) {
        const key = v?.colorId != null ? `color-${v.colorId}` : `no-color-${v.sizeLabel || v.id}`;
        if (!grouped.has(key)) {
          const parsedImages = parseColorImageUrls(v?.color);
          grouped.set(key, {
            id: key,
            colorId: v?.colorId ?? null,
            colorName: v?.color?.name || "",
            colorHex: v?.color?.hexCode || "#000000",
            images: [],
            imagePreviews: [],
            existingImages: parsedImages,
            galleryOrder: buildVariantGalleryOrder(parsedImages, []),
            sizeStocks: {},
            collapsed: false,
          });
        }
        const normalizedSize = String(v?.sizeLabel || "").trim().toUpperCase();
        if (normalizedSize && SIZE_OPTIONS.includes(normalizedSize)) {
          grouped.get(key).sizeStocks[normalizedSize] = String(v?.stock ?? 0);
        }
      }

      setProductVariants([...grouped.values()]);
  setExistingImages(product.images || []);
      setExistingVideos(product.videos && Array.isArray(product.videos) ? product.videos : []);
      setInstagramEmbeds(product.instagramEmbeds && Array.isArray(product.instagramEmbeds) ? product.instagramEmbeds : []);
      // Handle both old (categoryId) and new (categories) format for backward compatibility
      if (product.categories && product.categories.length > 0) {
        setSelectedCategories(product.categories.map((pc) => pc.categoryId || pc.category?.id || pc.id));
      } else if (product.categoryId) {
        setSelectedCategories([product.categoryId]);
      } else {
        setSelectedCategories([]);
      }
    } else {
      // Reset form
      setFormData({
        name: "",
        description: "",
        price: "",
        badge: "",
        isNew: false,
        isTrending: false,
        originalPrice: "",
        keywords: "",
        ...emptyHighlightFormFields(),
      });
      setProductVariants([]);
      setExistingImages([]);
      setInstagramEmbeds([]);
      setSelectedCategories([]);
    }

    // snapshot after state settles
    setTimeout(() => {
      initialSnapshotRef.current = JSON.stringify({
        formData: product
          ? {
              name: product.name || "",
              description: product.description || "",
              price:
                Array.isArray(product?.variants) && product.variants.length > 0 && product.variants[0]?.price != null
                  ? String(product.variants[0].price)
                  : product?.sizes?.[0]?.price != null
                  ? String(product.sizes[0].price)
                  : "",
              badge: product.badge || "",
              isNew: product.isNew || false,
              isTrending: product.isTrending || false,
              originalPrice: product.originalPrice != null ? String(product.originalPrice) : "",
              keywords: product.keywords ? (Array.isArray(product.keywords) ? product.keywords.join(", ") : product.keywords) : "",
              ...highlightFormFieldsFromProduct(product),
            }
          : {
              name: "",
              description: "",
              price: "",
              badge: "",
              isNew: false,
              isTrending: false,
              originalPrice: "",
              keywords: "",
              ...emptyHighlightFormFields(),
            },
        sizes:
          product?.sizes && product.sizes.length > 0
            ? product.sizes.map((s) => ({ label: s.label, stock: s.stock ?? 0 }))
            : [],
        productVariants:
          Array.isArray(product?.colors)
            ? product.colors.map((c) => {
                const sizeStocks = {};
                (product.variants || [])
                  .filter((v) => v?.colorId === c.id)
                  .forEach((v) => {
                    const size = String(v?.sizeLabel || "").trim().toUpperCase();
                    if (size && SIZE_OPTIONS.includes(size)) {
                      sizeStocks[size] = String(v?.stock ?? 0);
                    }
                  });
                return {
                  colorName: c?.name || "",
                  colorHex: c?.hexCode || "#000000",
                  sizeStocks,
                  galleryOrder: buildVariantGalleryOrder(parseColorImageUrls(c), []),
                };
              })
            : [],
        existingImages: product?.images || [],
        existingVideos: product?.videos && Array.isArray(product.videos) ? product.videos : [],
        selectedCategories:
          product?.categories && product.categories.length > 0
            ? product.categories.map((pc) => pc.categoryId || pc.category?.id || pc.id)
            : product?.categoryId
            ? [product.categoryId]
            : [],
        imagesSelectedCount: 0,
      });
    }, 0);
  }, [product]);

  

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    // Validation: At least one category is required
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }
    
    if (productVariants.length === 0) {
      toast.error("Please add at least one product variant");
      return;
    }

    if (!(parseFloat(formData.price) > 0)) {
      toast.error("Please enter a valid product price");
      return;
    }

    for (const block of productVariants) {
      if (!block.colorName?.trim()) {
        toast.error("Please enter color name for each variant block");
        return;
      }
      if ((block.images?.length || 0) === 0 && (block.existingImages?.length || 0) === 0) {
        toast.error(`Please upload images for color "${block.colorName}"`);
        return;
      }
      const selectedSizes = Object.keys(block.sizeStocks || {});
      if (selectedSizes.length === 0) {
        toast.error(`Please select at least one size for color "${block.colorName}"`);
        return;
      }
      for (const size of selectedSizes) {
        const stockValue = Math.max(0, parseInt(block.sizeStocks[size], 10) || 0);
        if (!Number.isFinite(stockValue) || stockValue < 0) {
          toast.error(`Invalid stock value for ${block.colorName} - ${size}`);
          return;
        }
      }
    }
    
    setLoading(true);
    isSubmittingRef.current = true;

    try {
      const formDataToSend = new FormData();

      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("badge", formData.badge);
      formDataToSend.append("isNew", formData.isNew);
      formDataToSend.append("isTrending", formData.isTrending);
      formDataToSend.append("originalPrice", formData.originalPrice || "");
      formDataToSend.append("materialComposition", formData.materialComposition || "");
      formDataToSend.append("pattern", formData.pattern || "");
      formDataToSend.append("fitType", formData.fitType || "");
      formDataToSend.append("sleeveType", formData.sleeveType || "");
      formDataToSend.append("collarStyle", formData.collarStyle || "");
      formDataToSend.append("lengthDetail", formData.lengthDetail || "");
      formDataToSend.append("countryOfOrigin", formData.countryOfOrigin || "");

      // Auto-generate keywords from product name if not already set
      let keywordsArray = [];
      if (formData.keywords && formData.keywords.trim() !== "") {
        keywordsArray = formData.keywords.split(",").map((k) => k.trim()).filter(k => k);
      } else {
        keywordsArray = generateKeywords(formData.name);
      }
      formDataToSend.append("keywords", JSON.stringify(keywordsArray));
      
      // Categories - send as array
      formDataToSend.append("categoryIds", JSON.stringify(selectedCategories));
      
      formDataToSend.append(
        "colors",
        JSON.stringify(
          (() => {
            let uploadIndex = 0;
            return productVariants
              .filter((b) => b.colorName?.trim())
              .map((b, index) => {
                const existingPhotoUrls = Array.isArray(b.existingImages)
                  ? b.existingImages.filter(Boolean)
                  : [];
                const galleryOrder = Array.isArray(b.galleryOrder) && b.galleryOrder.length > 0
                  ? b.galleryOrder
                  : buildVariantGalleryOrder(existingPhotoUrls, b.images || []);

                const photoUrls = [];
                for (const item of galleryOrder) {
                  if (item.kind === "existing") {
                    const url = existingPhotoUrls[item.index];
                    if (url) photoUrls.push(url);
                    continue;
                  }

                  const file = (b.images || [])[item.index];
                  if (file) {
                    const token = `__COLOR_UPLOAD_${uploadIndex}__`;
                    photoUrls.push(token);
                    formDataToSend.append("colorPhotos", file);
                    uploadIndex += 1;
                  }
                }

                return {
                  key: b.id,
                  name: b.colorName.trim(),
                  hexCode: b.colorHex || "#000000",
                  photoUrl: photoUrls[0] || "",
                  photoUrls,
                  order: index,
                };
              });
          })()
        )
      );

      const variantsPayload = [];
      for (const b of productVariants) {
        const selectedSizes = Object.keys(b.sizeStocks || {});
        for (const sizeLabel of selectedSizes) {
          variantsPayload.push({
            colorKey: b.id,
            colorName: b.colorName,
            sizeLabel,
            price: parseFloat(formData.price) || 0,
            originalPrice: formData.originalPrice != null && formData.originalPrice !== "" ? parseFloat(formData.originalPrice) : null,
            stock: Math.max(0, parseInt(b.sizeStocks[sizeLabel], 10) || 0),
            sku: null,
          });
        }
      }
      formDataToSend.append("variants", JSON.stringify(variantsPayload));

      // Keep DB clean from legacy fruit weight payloads.
      formDataToSend.append(
        "weightOptions",
        JSON.stringify([])
      );
      formDataToSend.append("hasSinglePrice", "false");
      formDataToSend.append("singlePrice", "");

      if (product && existingImages.length > 0) {
        formDataToSend.append("existingImages", JSON.stringify(existingImages));
      }
      if (product && existingVideos.length > 0) {
        formDataToSend.append("existingVideos", JSON.stringify(existingVideos));
      }

      videos.forEach((file) => {
        formDataToSend.append("videos", file);
      });
      formDataToSend.append("instagramEmbeds", JSON.stringify(instagramEmbeds));

      const url = isEdit ? `${API}/products/${product.id}` : `${API}/products`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        body: formDataToSend,
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(isEdit ? "Product updated" : "Product created");
        onSave();
        // Reset form
        setFormData({
          name: "",
          description: "",
          price: "",
          badge: "",
          isNew: false,
          isTrending: false,
          originalPrice: "",
          keywords: "",
          ...emptyHighlightFormFields(),
        });
        setProductVariants([]);
        setExistingImages([]);
        setSelectedCategories([]);
        setVariantDraggedImage(null);
        setVariantImageDropActiveId(null);
        initialSnapshotRef.current = "";
      } else {
        toast.error(data.error || data.message || "Failed to save product");
      }
    } catch (error) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleCancel = () => {
    if (loading) return;
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
      if (!ok) return;
    }
    // Reset to blank (create mode) and exit edit mode
    setFormData({
      name: "",
      description: "",
      price: "",
      badge: "",
      isNew: false,
      isTrending: false,
      originalPrice: "",
      keywords: "",
      ...emptyHighlightFormFields(),
    });
    setProductVariants([]);
    setExistingImages([]);
    setVariantDraggedImage(null);
    setVariantImageDropActiveId(null);
    setVideos([]);
    setExistingVideos([]);
    setSelectedCategories([]);
    initialSnapshotRef.current = "";
    onCancel?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }
    if (e.key === "Enter") {
      const tag = e.target?.tagName;
      if (tag === "TEXTAREA") return;
      if (loading) return;
      // Let selects behave normally; still allow Enter to submit otherwise
      e.preventDefault();
      formRef.current?.requestSubmit?.();
    }
  };

  const addVariantBlock = () => {
    setProductVariants((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        colorName: "",
        colorHex: "#000000",
        images: [],
        imagePreviews: [],
        existingImages: [],
        galleryOrder: [],
        collapsed: false,
      },
    ]);
  };

  const updateVariantBlock = (id, patch) => {
    setProductVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const removeVariantBlock = (id) => {
    setProductVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const toggleVariantCollapse = (id) => {
    setProductVariants((prev) => prev.map((v) => (v.id === id ? { ...v, collapsed: !v.collapsed } : v)));
  };

  const toggleVariantSize = (id, sizeLabel, checked) => {
    setProductVariants((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const nextSizeStocks = { ...(v.sizeStocks || {}) };
      if (checked) nextSizeStocks[sizeLabel] = nextSizeStocks[sizeLabel] ?? "9999";
      else delete nextSizeStocks[sizeLabel];
      return { ...v, sizeStocks: nextSizeStocks };
    }));
  };

  const updateVariantSizeStock = (id, sizeLabel, stockValue) => {
    setProductVariants((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      return {
        ...v,
        sizeStocks: {
          ...(v.sizeStocks || {}),
          [sizeLabel]: stockValue,
        },
      };
    }));
  };

  const handleVariantImagesChange = (id, files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const target = productVariants.find((v) => v.id === id);
    if (!target?.colorName?.trim()) {
      toast.error("Enter color name first, then upload images");
      return;
    }
    const previews = selected.map((f) => URL.createObjectURL(f));
    setProductVariants((prev) => prev.map((v) => (
      v.id === id
        ? (() => {
            const nextImages = [...(v.images || []), ...selected];
            const nextPreviews = [...(v.imagePreviews || []), ...previews];
            return {
              ...v,
              images: nextImages,
              imagePreviews: nextPreviews,
              galleryOrder: buildVariantGalleryOrder(v.existingImages || [], nextImages),
            };
          })()
        : v
    )));
  };

  const reorderVariantGallery = (variantId, fromPosition, toPosition) => {
    if (fromPosition === toPosition) return;
    setProductVariants((prev) => prev.map((v) => {
      if (v.id !== variantId) return v;
      const order = Array.isArray(v.galleryOrder) && v.galleryOrder.length > 0
        ? v.galleryOrder
        : buildVariantGalleryOrder(v.existingImages || [], v.images || []);
      if (fromPosition < 0 || toPosition < 0 || fromPosition >= order.length || toPosition >= order.length) {
        return v;
      }
      return {
        ...v,
        galleryOrder: moveArrayItem(order, fromPosition, toPosition),
      };
    }));
  };

  const removeVariantNewImage = (id, imageIndex) => {
    setProductVariants((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const nextImages = [...(v.images || [])];
      const nextPreviews = [...(v.imagePreviews || [])];
      const nextOrder = (v.galleryOrder || []).filter((item) => !(item.kind === "new" && item.index === imageIndex));
      const removedPreview = nextPreviews[imageIndex];
      if (typeof removedPreview === "string" && removedPreview.startsWith("blob:")) {
        URL.revokeObjectURL(removedPreview);
      }
      nextImages.splice(imageIndex, 1);
      nextPreviews.splice(imageIndex, 1);
      const normalizedOrder = nextOrder.map((item) => {
        if (item.kind === "new" && item.index > imageIndex) {
          return { ...item, index: item.index - 1 };
        }
        return item;
      });
      return {
        ...v,
        images: nextImages,
        imagePreviews: nextPreviews,
        galleryOrder: normalizedOrder,
      };
    }));
  };

  const removeVariantExistingImage = (id, imageIndex) => {
    setProductVariants((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      const nextExisting = [...(v.existingImages || [])];
      const nextOrder = (v.galleryOrder || []).filter((item) => !(item.kind === "existing" && item.index === imageIndex));
      nextExisting.splice(imageIndex, 1);
      const normalizedOrder = nextOrder.map((item) => {
        if (item.kind === "existing" && item.index > imageIndex) {
          return { ...item, index: item.index - 1 };
        }
        return item;
      });
      return {
        ...v,
        existingImages: nextExisting,
        galleryOrder: normalizedOrder,
      };
    }));
  };

  const pickColorFromImageClick = (id, e) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const toHex = (n) => n.toString(16).padStart(2, "0");
    const hex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`.toUpperCase();
    updateVariantBlock(id, { colorHex: hex });
  };

  // Generate product description via backend (one-time per product when cached; Regenerate forces new)
  const handleGenerateDescription = async (forceRegenerate = false) => {
    if (!formData.name?.trim()) {
      toast.error("Enter product name first");
      return;
    }
    setGeneratingDescription(true);
    try {
      const categoryNames = selectedCategories
        .map((id) => categories.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const sizeVariant = [...new Set(productVariants.flatMap((v) => Object.keys(v.sizeStocks || {})))]
        .filter(Boolean)
        .join(", ");
      const allPrices = [parseFloat(formData.price)].filter((p) => Number.isFinite(p) && p > 0);
      let priceRange = "";
      if (allPrices.length > 0) {
        const minPrice = Math.min(...allPrices);
        priceRange = `₹${minPrice}`;
      }
      const payload = {
        product_name: formData.name.trim(),
        category: categoryNames || "General",
        size: sizeVariant || "One size",
        material: "",
        color: "",
        target_audience: "",
        price_range: priceRange || "",
        use_case: "",
        features: formData.keywords || formData.badge || "",
        language: descriptionLanguage,
      };
      if (isEdit && product?.id) {
        payload.productId = product.id;
        payload.forceRegenerate = forceRegenerate;
      }
      const firstVariantWithImage = productVariants.find(
        (v) => (v.existingImages?.length || 0) > 0 || (v.imagePreviews?.length || 0) > 0
      );
      const firstImageUrl = firstVariantWithImage?.existingImages?.[0] || null;
      if (firstImageUrl) {
        payload.imageUrl = firstImageUrl.startsWith("http") ? firstImageUrl : `${API}${firstImageUrl.startsWith("/") ? "" : "/"}${firstImageUrl}`;
      }
      const res = await fetch(`${API}/generate-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      if (data.description) setFormData((prev) => ({ ...prev, description: data.description }));
      toast.success(data.fromCache ? "Description loaded from cache" : "Description generated");
    } catch (e) {
      toast.error(e.message || "Could not generate description");
    } finally {
      setGeneratingDescription(false);
    }
  };

  // Generate keywords from product name
  const generateKeywords = (productName) => {
    if (!productName || productName.trim() === "") {
      return [];
    }
    
    // Convert to lowercase and split by spaces, hyphens, and other separators
    const words = productName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .split(/[\s-]+/) // Split by spaces and hyphens
      .filter(word => word.length > 2) // Filter out very short words
      .filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates
    
    // Also add the full name as a keyword (if it's not too long)
    if (productName.length <= 50) {
      words.unshift(productName.toLowerCase().trim());
    }
    
    return words;
  };

  // Track previous product name to detect changes
  const prevProductNameRef = useRef("");
  const isInitialLoadRef = useRef(true);
  
  // Auto-generate keywords when product name changes
  useEffect(() => {
    // On initial load, set the ref and skip auto-generation
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevProductNameRef.current = formData.name || "";
      return;
    }
    
    // Only auto-generate if name actually changed (not on initial load)
    if (formData.name && formData.name.trim() !== "" && formData.name !== prevProductNameRef.current) {
      const autoKeywords = generateKeywords(formData.name);
      const keywordsString = autoKeywords.join(", ");
      
      setFormData(prev => ({
        ...prev,
        keywords: keywordsString
      }));
      
      prevProductNameRef.current = formData.name;
    } else if (!formData.name || formData.name.trim() === "") {
      // Clear keywords if name is empty
      setFormData(prev => ({
        ...prev,
        keywords: ""
      }));
      prevProductNameRef.current = "";
    }
  }, [formData.name]);
  
  // Reset initial load flag when product changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    prevProductNameRef.current = "";
  }, [product]);

  return (
    <div className="rounded-xl shadow-md p-6 mb-6 border" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          {isEdit ? "Edit Product" : "Add New Product"}
        </h2>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit?.()}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
            )}
            {isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>Product Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>Categories *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-3 rounded-xl border-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
            {[...categories]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                      isSelected ? "border-pink-500" : "border-gray-200 bg-white hover:border-pink-300"
                    }`}
                    style={isSelected ? { backgroundColor: "var(--primary)" } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          setSelectedCategories(selectedCategories.filter((id) => id !== cat.id));
                        } else {
                          setSelectedCategories([...selectedCategories, cat.id]);
                        }
                      }}
                      className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500 shrink-0"
                    />
                    <span className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-gray-700"}`}>{cat.name}</span>
                  </label>
                );
              })}
          </div>
          {selectedCategories.length === 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Select at least one category.</p>
          )}
        </div>

        <div className="rounded-xl border-2 border-neutral-200 bg-neutral-100 p-4 md:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Top highlights (optional)</h3>
            <p className="text-xs mt-1 text-neutral-600">
              Shown on the product page above &quot;About this item&quot;. Leave blank to hide a row.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRODUCT_HIGHLIGHT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5 text-neutral-600">{label}</label>
                <input
                  type="text"
                  value={formData[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 focus:border-neutral-300"
                  placeholder="Optional"
                  maxLength={500}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 border-neutral-200 bg-neutral-100 p-4 md:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">About this item *</h3>
            <p className="text-xs mt-1 text-neutral-600">
              Long-form copy for the product page. Use a blank line between paragraphs.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-600">AI assist</span>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={descriptionLanguage}
                onChange={(e) => setDescriptionLanguage(e.target.value)}
                className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400/40"
                disabled={generatingDescription}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Hinglish">Hinglish</option>
              </select>
              <button
                type="button"
                onClick={() => handleGenerateDescription(false)}
                disabled={generatingDescription}
                className="text-sm px-3 py-1.5 bg-white border border-neutral-200 text-neutral-800 rounded-lg font-medium hover:bg-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {generatingDescription ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate description"
                )}
              </button>
              {isEdit && product?.id && (
                <button
                  type="button"
                  onClick={() => handleGenerateDescription(true)}
                  disabled={generatingDescription}
                  className="text-sm px-3 py-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Regenerate
                </button>
              )}
            </div>
          </div>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/40 focus:border-neutral-300 transition min-h-28"
            rows="5"
            required
            placeholder="Describe the product for shoppers…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Product Price *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
              placeholder="Enter selling price"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">MRP (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.originalPrice}
              onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
              className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Badge (e.g., 60 Min Delivery)</label>
            <input
              type="text"
              value={formData.badge}
              onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
              className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Options</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isNew}
                  onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">New Arrival</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isTrending}
                  onChange={(e) => setFormData({ ...formData, isTrending: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Trending</span>
              </label>
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-4 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Variant Type
              </label>
              <select
                value={variantMode}
                onChange={(e) => setVariantMode(e.target.value)}
                className="w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
              >
                <option value="color">Color</option>
              </select>
            </div>
            <div className="flex justify-start md:justify-end">
              <button
                type="button"
                onClick={addVariantBlock}
                className="px-4 py-2.5 text-white rounded-lg text-sm font-semibold transition"
                style={{ backgroundColor: "var(--primary)" }}
              >
                + Add New Product Variant
              </button>
            </div>
          </div>

          {productVariants.length === 0 ? (
            <p className="text-sm text-gray-500">No product variants added yet.</p>
          ) : (
            <div className="space-y-4">
              {productVariants.map((variant, vIndex) => (
                <div key={variant.id} className="rounded-lg border bg-white" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Variant {vIndex + 1}</span>
                      <span className="text-xs text-gray-500">{variant.colorName || "Color name pending"}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleVariantCollapse(variant.id)}
                        className="px-2 py-1 rounded border text-xs"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        {variant.collapsed ? "Expand" : "Collapse"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariantBlock(variant.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {!variant.collapsed && (
                    <div className="p-3 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Colour Name *</label>
                        <input
                          type="text"
                          value={variant.colorName}
                          onChange={(e) => updateVariantBlock(variant.id, { colorName: e.target.value })}
                          placeholder="e.g., Red"
                          className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Upload Product Images For This Variant *</label>
                        <input
                          ref={(el) => { variantImageInputRefs.current[variant.id] = el; }}
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={!variant.colorName?.trim()}
                          onChange={(e) => {
                            handleVariantImagesChange(variant.id, e.target.files);
                            e.target.value = "";
                          }}
                          className="hidden"
                        />
                        <div
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!variant.colorName?.trim()) return;
                            setVariantImageDropActiveId(variant.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!variant.colorName?.trim()) return;
                            setVariantImageDropActiveId(variant.id);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (variantImageDropActiveId === variant.id) {
                              setVariantImageDropActiveId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setVariantImageDropActiveId(null);
                            if (!variant.colorName?.trim()) return;
                            handleVariantImagesChange(variant.id, e.dataTransfer.files);
                          }}
                          className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
                            variantImageDropActiveId === variant.id
                              ? "border-pink-500 bg-pink-50"
                              : "border-gray-200 bg-white hover:border-pink-300"
                          }`}
                        >
                          <p className="text-xs text-gray-700">
                            Drag and drop images here, or{" "}
                            <button
                              type="button"
                              disabled={!variant.colorName?.trim()}
                              onClick={() => variantImageInputRefs.current[variant.id]?.click()}
                              className="font-semibold underline disabled:opacity-50"
                            >
                              browse
                            </button>
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">Drag thumbnails below to set top image (first one).</p>
                        </div>
                        {!variant.colorName?.trim() && (
                          <p className="text-xs text-amber-700 mt-1">Enter colour name first, then upload variant images.</p>
                        )}
                      </div>

                      {(variant.imagePreviews?.length > 0 || variant.existingImages?.length > 0) && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-xs font-semibold text-gray-600">Pick Color From Uploaded Image</label>
                            <input
                              type="color"
                              value={variant.colorHex || "#000000"}
                              onChange={(e) => updateVariantBlock(variant.id, { colorHex: e.target.value.toUpperCase() })}
                              className="w-10 h-8 p-0 border rounded"
                            />
                            <span className="text-xs text-gray-600">{(variant.colorHex || "#000000").toUpperCase()}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(variant.galleryOrder) && variant.galleryOrder.length > 0
                              ? variant.galleryOrder
                              : buildVariantGalleryOrder(variant.existingImages || [], variant.images || [])
                            ).map((entry, position) => {
                              const src = entry.kind === "existing"
                                ? (variant.existingImages || [])[entry.index]
                                : (variant.imagePreviews || [])[entry.index];
                              if (!src) return null;
                              return (
                                <div
                                  key={`${variant.id}-${entry.kind}-${entry.index}-${position}`}
                                  draggable
                                  onDragStart={(e) => {
                                    setVariantDraggedImage({ variantId: variant.id, fromPosition: position });
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragEnd={() => setVariantDraggedImage(null)}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (variantDraggedImage?.variantId === variant.id) {
                                      reorderVariantGallery(variant.id, variantDraggedImage.fromPosition, position);
                                    }
                                    setVariantDraggedImage(null);
                                  }}
                                  className={`relative group cursor-grab active:cursor-grabbing ${position === 0 ? "ring-2 ring-pink-400 rounded-lg" : ""}`}
                                >
                                  {position === 0 && (
                                    <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold">
                                      Top
                                    </span>
                                  )}
                                  <img
                                    src={src}
                                    alt={`${variant.colorName || "variant"} ${position + 1}`}
                                    onClick={(e) => pickColorFromImageClick(variant.id, e)}
                                    className="h-20 w-20 object-cover rounded-lg border cursor-crosshair"
                                    style={{ borderColor: "var(--border)" }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (entry.kind === "existing") removeVariantExistingImage(variant.id, entry.index);
                                      else removeVariantNewImage(variant.id, entry.index);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition"
                                    aria-label="Remove image"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="border rounded-lg p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
                        <label className="text-xs font-semibold text-gray-700 block mb-2">Available Sizes</label>
                        <div className="grid grid-cols-6 sm:grid-cols- md:grid-cols-12 gap-2">
                          {SIZE_OPTIONS.map((size) => {
                            const checked = Object.prototype.hasOwnProperty.call(variant.sizeStocks || {}, size);
                            return (
                              <label key={`${variant.id}-${size}`} className="inline-flex items-center gap-2 px-2 py-2 rounded-xs bg-teal-50" style={{ borderColor: "var(--border)" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleVariantSize(variant.id, size, e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{size}</span>
                              </label>
                            );
                          })}
                        </div>

                        {Object.keys(variant.sizeStocks || {}).length > 0 && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {SIZE_OPTIONS.filter((size) => Object.prototype.hasOwnProperty.call(variant.sizeStocks || {}, size)).map((size) => (
                              <div key={`${variant.id}-${size}-stock`} className="flex items-center gap-2">
                                <span className="text-xs font-semibold w-10" style={{ color: "var(--foreground)" }}>{size}</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={variant.sizeStocks?.[size] ?? "0"}
                                  onChange={(e) => updateVariantSizeStock(variant.id, size, e.target.value)}
                                  className="w-full px-2 py-1.5 border rounded-lg text-sm"
                                  style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
                                  placeholder="Stock"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <VideoUpload
          videos={videos}
          existingVideos={existingVideos}
          onVideosChange={setVideos}
          onExistingVideosChange={setExistingVideos}
        />

        <InstagramEmbedInput
          instagramEmbeds={instagramEmbeds}
          onChange={setInstagramEmbeds}
        />

        <div className="sticky bottom-0 pt-4 pb-2 border-t" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              )}
              {isEdit ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
