import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "../../api";
import ImageUpload from "./ImageUpload";
import VideoUpload from "./VideoUpload";
import InstagramEmbedInput from "./InstagramEmbedInput";
import { useToast } from "../../context/ToastContext";

// Treat as "edit" only when product has a valid id (duplicate passes product with id null/undefined)
const isEditProduct = (p) => p && (p.id != null && p.id !== "");

export default function ProductForm({ product, categories, onSave, onCancel }) {
  const toast = useToast();
  const isEdit = isEditProduct(product);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    badge: "",
    isFestival: false,
    isNew: false,
    isTrending: false,
    isReady60Min: false,
    originalPrice: "", // MRP for single-price products
    keywords: "",
  });
  const [sizes, setSizes] = useState([]);
  const [sizeSellingPrice, setSizeSellingPrice] = useState("");
  const [sizeMrp, setSizeMrp] = useState("");
  const [sizeOptions, setSizeOptions] = useState([]); // Reusable size options from API
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [instagramEmbeds, setInstagramEmbeds] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [, setLoadingSizeOptions] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionLanguage, setDescriptionLanguage] = useState("English");
  const formRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const initialSnapshotRef = useRef("");

  const snapshot = useMemo(() => {
    return JSON.stringify({
      formData,
      sizes,
      sizeSellingPrice,
      sizeMrp,
      existingImages,
      selectedCategories,
      // For new images, treat any selection as "dirty"
      imagesSelectedCount: images.length,
    });
  }, [formData, sizes, sizeSellingPrice, sizeMrp, existingImages, selectedCategories, images.length]);

  const isDirty = initialSnapshotRef.current !== "" && snapshot !== initialSnapshotRef.current;

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        badge: product.badge || "",
        isFestival: product.isFestival || false,
        isNew: product.isNew || false,
        isTrending: product.isTrending || false,
        isReady60Min: product.isReady60Min || false,
        originalPrice: product.originalPrice != null ? String(product.originalPrice) : "",
        keywords: product.keywords ? (Array.isArray(product.keywords) ? product.keywords.join(", ") : product.keywords) : "",
      });
      setSizes(
        product.sizes && product.sizes.length > 0
          ? product.sizes.map((s) => ({
              label: s.label,
              stock: String(typeof s.stock === "number" ? s.stock : s.stock ?? "0"),
            }))
          : []
      );
      const firstSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : null;
      setSizeSellingPrice(firstSize?.price != null ? String(firstSize.price) : "");
      setSizeMrp(firstSize?.originalPrice != null ? String(firstSize.originalPrice) : "");
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
        badge: "",
        isFestival: false,
        isNew: false,
        isTrending: false,
        isReady60Min: false,
        originalPrice: "",
        keywords: "",
      });
      setSizes([]);
      setSizeSellingPrice("");
      setSizeMrp("");
      setImages([]);
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
              badge: product.badge || "",
              isFestival: product.isFestival || false,
              isNew: product.isNew || false,
              isTrending: product.isTrending || false,
              isReady60Min: product.isReady60Min || false,
              originalPrice: product.originalPrice != null ? String(product.originalPrice) : "",
              keywords: product.keywords ? (Array.isArray(product.keywords) ? product.keywords.join(", ") : product.keywords) : "",
            }
          : {
              name: "",
              description: "",
              badge: "",
              isFestival: false,
              isNew: false,
              isTrending: false,
              isReady60Min: false,
              originalPrice: "",
              keywords: "",
            },
        sizes:
          product?.sizes && product.sizes.length > 0
            ? product.sizes.map((s) => ({ label: s.label, stock: s.stock ?? 0 }))
            : [],
        sizeSellingPrice:
          product?.sizes && product.sizes.length > 0 && product.sizes[0]?.price != null
            ? String(product.sizes[0].price)
            : "",
        sizeMrp:
          product?.sizes && product.sizes.length > 0 && product.sizes[0]?.originalPrice != null
            ? String(product.sizes[0].originalPrice)
            : "",
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

  // Fetch reusable size options when form mounts
  useEffect(() => {
    let cancelled = false;
    setLoadingSizeOptions(true);
    fetch(`${API}/size-options`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setSizeOptions(data);
      })
      .catch(() => {})
      .finally(() => setLoadingSizeOptions(false));
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    // Validation: At least one category is required
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }
    
    if (sizes.length === 0) {
      toast.error("Please select at least one size");
      return;
    }
    if (!sizeSellingPrice || parseFloat(sizeSellingPrice) <= 0) {
      toast.error("Please enter a valid product price");
      return;
    }
    
    setLoading(true);
    isSubmittingRef.current = true;

    try {
      const token = localStorage.getItem("adminToken");
      const formDataToSend = new FormData();

      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("badge", formData.badge);
      formDataToSend.append("isFestival", formData.isFestival);
      formDataToSend.append("isNew", formData.isNew);
      formDataToSend.append("isTrending", formData.isTrending);
      formDataToSend.append("isReady60Min", formData.isReady60Min);
      formDataToSend.append("originalPrice", sizeMrp ? sizeMrp : "");
      
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
      
      // Sizes use shared price/MRP with per-size stock.
      formDataToSend.append(
        "sizes",
        JSON.stringify(
          sizes.filter((s) => s.label).map((s) => ({
            label: s.label,
            price: sizeSellingPrice,
            originalPrice: sizeMrp != null && sizeMrp !== "" ? sizeMrp : null,
            stock: Math.max(0, parseInt(s.stock, 10) || 0),
          }))
        )
      );

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

      images.forEach((file) => {
        formDataToSend.append("images", file);
      });
      videos.forEach((file) => {
        formDataToSend.append("videos", file);
      });
      formDataToSend.append("instagramEmbeds", JSON.stringify(instagramEmbeds));

      const url = isEdit ? `${API}/products/${product.id}` : `${API}/products`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
          badge: "",
          isFestival: false,
          isNew: false,
          isTrending: false,
          isReady60Min: false,
          originalPrice: "",
          keywords: "",
        });
        setSizes([]);
        setSizeSellingPrice("");
        setSizeMrp("");
        setImages([]);
        setExistingImages([]);
        setSelectedCategories([]);
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
      badge: "",
      isFestival: false,
      isNew: false,
      isTrending: false,
      isReady60Min: false,
      originalPrice: "",
      keywords: "",
    });
    setSizes([]);
    setSizeSellingPrice("");
    setSizeMrp("");
    setImages([]);
    setExistingImages([]);
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

  const removeSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const updateSize = (index, field, value) => {
    const newSizes = [...sizes];
    if (!newSizes[index]) return;
    newSizes[index] = { ...newSizes[index], [field]: value };
    setSizes(newSizes);
  };

  // Toggle saved size option: add/remove from selected sizes
  const toggleSizeOption = (label) => {
    const existing = sizes.find((s) => (s.label || "").trim().toLowerCase() === (label || "").trim().toLowerCase());
    if (existing) {
      setSizes(sizes.filter((s) => (s.label || "").trim().toLowerCase() !== (label || "").trim().toLowerCase()));
    } else {
      setSizes([...sizes, { label: label.trim(), stock: "0" }]);
    }
  };

  // Add custom size and optionally save to reusable options
  const addCustomSize = async (label, saveAsReusable = false) => {
    const trimmed = (label || "").trim();
    if (!trimmed) return;
    if (sizes.some((s) => (s.label || "").trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This size is already added");
      return;
    }
    setSizes([...sizes, { label: trimmed, stock: "0" }]);
    if (saveAsReusable) {
      try {
        const token = localStorage.getItem("adminToken");
        await fetch(`${API}/size-options`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ label: trimmed }),
        });
      } catch {
        // Ignore failures when saving reusable size option.
      }
    }
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
      const sizeVariant = sizes.map((s) => s.label).filter(Boolean).join(", ");
      let priceRange = "";
      if (sizeSellingPrice) priceRange = `₹${sizeSellingPrice}`;
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
      const firstImageUrl = existingImages?.length > 0 ? existingImages[0] : null;
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
                      isSelected ? "border-pink-500 bg-pink-50" : "border-gray-200 bg-white hover:border-pink-300"
                    }`}
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
                    <span className="text-sm font-medium text-gray-700 truncate">{cat.name}</span>
                  </label>
                );
              })}
          </div>
          {selectedCategories.length === 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Select at least one category.</p>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-semibold text-gray-700">Description *</label>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={descriptionLanguage}
                onChange={(e) => setDescriptionLanguage(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500"
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
                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {generatingDescription ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
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
                  className="text-sm px-3 py-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Regenerate
                </button>
              )}
            </div>
          </div>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
            rows="4"
            required
          />
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
                  checked={formData.isFestival}
                  onChange={(e) => setFormData({ ...formData, isFestival: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Festival Item</span>
              </label>
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isReady60Min}
                  onChange={(e) => setFormData({ ...formData, isReady60Min: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">60 Minutes Ready</span>
              </label>
            </div>
          </div>
        </div>

        <ImageUpload
          images={images}
          existingImages={existingImages}
          onImagesChange={setImages}
          onExistingImagesChange={setExistingImages}
        />

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

        <div className="border-t border-gray-200 pt-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">Sizes & Stock</label>
            </div>
            {sizeOptions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">Select saved sizes:</p>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((opt) => {
                    const isSelected = sizes.some((s) => (s.label || "").trim().toLowerCase() === (opt.label || "").trim().toLowerCase());
                    return (
                      <label
                        key={opt.id}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                          isSelected ? "border-pink-500 bg-pink-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSizeOption(opt.label)}
                          className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Our Price *</label>
                <input
                  type="number"
                  value={sizeSellingPrice}
                  onChange={(e) => setSizeSellingPrice(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
                  step="0.01"
                  min="0"
                  placeholder="e.g., 999"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">MRP (optional)</label>
                <input
                  type="number"
                  value={sizeMrp}
                  onChange={(e) => setSizeMrp(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--foreground)" }}
                  step="0.01"
                  min="0"
                  placeholder="e.g., 1299"
                />
              </div>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              <input
                type="text"
                id="custom-size-label"
                placeholder="Custom size"
                className="flex-1 min-w-30 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-pink-500 transition"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const input = e.target;
                    addCustomSize(input.value, false);
                    input.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("custom-size-label");
                  if (input) {
                    addCustomSize(input.value, false);
                    input.value = "";
                  }
                }}
                className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 transition"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("custom-size-label");
                  if (input) {
                    addCustomSize(input.value, true);
                    input.value = "";
                    toast.success("Size added and saved for future products");
                  }
                }}
                className="px-4 py-2.5 border-2 border-pink-500 text-pink-600 rounded-lg text-sm font-semibold hover:bg-pink-50 transition"
              >
                Add & save for future
              </button>
            </div>

            <div className="space-y-3">
              {sizes.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No sizes added. Select from above or add a custom size.</p>
              ) : (
                sizes.map((size, index) => (
                  <div key={index} className="flex flex-wrap gap-2 items-center p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                    <span className="font-semibold text-gray-700 min-w-16">{size.label}</span>
                    <input
                      type="number"
                      placeholder="Stock"
                      value={size.stock ?? ""}
                      onChange={(e) => updateSize(index, "stock", e.target.value)}
                      className="w-20 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-pink-500 transition text-sm"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => removeSize(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

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
