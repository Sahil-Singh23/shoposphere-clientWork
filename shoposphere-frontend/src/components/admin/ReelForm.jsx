import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "../../api";
import { useToast } from "../../context/ToastContext";

export default function ReelForm({ reel, onSave, onCancel }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    title: "",
    url: "",
    thumbnail: "",
    platform: "native",
    isActive: true,
    order: 0,
    productId: "",
    isTrending: false,
    isFeatured: false,
    discountPct: "",
    placement: "home",
  });
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState(null);
  const [existingThumbnail, setExistingThumbnail] = useState(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const videoInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const initialSnapshotRef = useRef("");

  const snapshot = useMemo(() => JSON.stringify(form), [form]);
  const isDirty = initialSnapshotRef.current !== "" && snapshot !== initialSnapshotRef.current;

  useEffect(() => {
    // load products for linking
    fetch(`${API}/products`)
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (reel) {
      setForm({
        title: reel.title || "",
        url: reel.url || "",
        thumbnail: reel.thumbnail || "",
        platform: reel.platform || "native",
        isActive: reel.isActive !== undefined ? reel.isActive : true,
        order: reel.order || 0,
        productId: reel.productId ? String(reel.productId) : "",
        isTrending: !!reel.isTrending,
        isFeatured: !!reel.isFeatured,
        discountPct: reel.discountPct !== null && reel.discountPct !== undefined ? String(reel.discountPct) : "",
        placement: reel.placement === "about" ? "about" : "home",
      });
      setExistingVideoUrl(reel.videoUrl || reel.url || null);
      setExistingThumbnail(reel.thumbnail || null);
      setThumbnailPreview(reel.thumbnail || null);
      setVideoFile(null);
      setThumbnailFile(null);
    } else {
      setForm({
        title: "",
        url: "",
        thumbnail: "",
        platform: "native",
        isActive: true,
        order: 0,
        productId: "",
        isTrending: false,
        isFeatured: false,
        discountPct: "",
        placement: "home",
      });
      setExistingVideoUrl(null);
      setExistingThumbnail(null);
      setThumbnailPreview(null);
      setVideoFile(null);
      setThumbnailFile(null);
    }

    setTimeout(() => {
      initialSnapshotRef.current = JSON.stringify(
        reel
          ? {
              title: reel.title || "",
              url: reel.url || "",
              thumbnail: reel.thumbnail || "",
              platform: reel.platform || "native",
              isActive: reel.isActive !== undefined ? reel.isActive : true,
              order: reel.order || 0,
              productId: reel.productId ? String(reel.productId) : "",
              isTrending: !!reel.isTrending,
              isFeatured: !!reel.isFeatured,
              discountPct: reel.discountPct !== null && reel.discountPct !== undefined ? String(reel.discountPct) : "",
              placement: reel.placement === "about" ? "about" : "home",
            }
          : {
              title: "",
              url: "",
              thumbnail: "",
              platform: "native",
              isActive: true,
              order: 0,
              productId: "",
              isTrending: false,
              isFeatured: false,
              discountPct: "",
              placement: "home",
            }
      );
    }, 0);
  }, [reel]);

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setVideoFile(file);
        // No inline video preview in form; keep selected file metadata only.
      } else {
        toast.error("Please select a video file");
      }
    }
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setThumbnailFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setThumbnailPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error("Please select an image file");
      }
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(existingThumbnail);
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    // Validate: either video file or URL must be provided
    if (!videoFile && !form.url) {
      toast.error("Please provide either a video file or video URL");
      return;
    }
    
    setLoading(true);
    isSubmittingRef.current = true;
    try {
      const url = reel
        ? `${API}/reels/${reel.id}`
        : `${API}/reels`;
      const method = reel ? "PUT" : "POST";

      const formDataToSend = new FormData();
      formDataToSend.append("title", form.title);
      formDataToSend.append("platform", form.platform);
      formDataToSend.append("isActive", form.isActive);
      formDataToSend.append("order", form.order);
      formDataToSend.append("productId", form.productId);
      formDataToSend.append("isTrending", form.isTrending);
      formDataToSend.append("isFeatured", form.isFeatured);
      formDataToSend.append("discountPct", form.discountPct);
      formDataToSend.append("placement", form.placement);
      
      // Add video: file takes priority over URL
      if (videoFile) {
        formDataToSend.append("video", videoFile);
      } else if (form.url) {
        formDataToSend.append("url", form.url);
        formDataToSend.append("videoUrl", form.url);
      }
      
      // Add thumbnail: file takes priority over URL
      if (thumbnailFile) {
        formDataToSend.append("thumbnail", thumbnailFile);
      } else if (form.thumbnail) {
        formDataToSend.append("thumbnail", form.thumbnail);
      }
      
      // For updates, preserve existing URLs if no new file/URL provided
      if (reel) {
        if (!videoFile && !form.url && existingVideoUrl) {
          formDataToSend.append("existingVideoUrl", existingVideoUrl);
        }
        if (!thumbnailFile && !form.thumbnail && existingThumbnail) {
          formDataToSend.append("existingThumbnail", existingThumbnail);
        }
      }

      const res = await fetch(url, {
        method,
        credentials: "include",
        body: formDataToSend,
      });

      if (res.ok) {
        toast.success(reel ? "Reel updated" : "Reel created");
        onSave();
        if (!reel) {
          setForm({
            title: "",
            url: "",
            thumbnail: "",
            platform: "native",
            isActive: true,
            order: 0,
            productId: "",
            isTrending: false,
            isFeatured: false,
            discountPct: "",
            placement: "home",
          });
          setVideoFile(null);
          setThumbnailFile(null);
          setThumbnailPreview(null);
          setExistingVideoUrl(null);
          setExistingThumbnail(null);
          if (videoInputRef.current) videoInputRef.current.value = "";
          if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
          initialSnapshotRef.current = "";
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save reel");
      }
    } catch (error) {
      console.error("Error saving reel:", error);
      toast.error("Error saving reel. Please try again.");
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
    setForm({
      title: "",
      url: "",
      thumbnail: "",
      platform: "native",
      isActive: true,
      order: 0,
      productId: "",
      isTrending: false,
      isFeatured: false,
      discountPct: "",
      placement: "home",
    });
    setVideoFile(null);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setExistingVideoUrl(null);
    setExistingThumbnail(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
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
      e.preventDefault();
      formRef.current?.requestSubmit?.();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {reel ? "Edit Reel" : "Add New Reel"}
        </h2>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit?.()}
            disabled={loading}
            className="px-4 py-2 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/40 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
            )}
            {reel ? "Update" : "Save"}
          </button>
        </div>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
            placeholder="Reel title"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Reel Video <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            {/* File Upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Upload Video File (or use URL below)
              </label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition text-sm"
              />
              {videoFile && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-600">{videoFile.name}</span>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            
            {/* URL Input */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Or Enter Video URL
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => {
                  setForm({ ...form, url: e.target.value });
                }}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
                placeholder="https://.../reel.mp4"
                disabled={!!videoFile}
              />
            </div>
          </div>
          <p className="text-xs mt-2 text-gray-500">
            Upload a video file (max 50MB) or provide a direct video URL. Ideally vertical 9:16 format. Muted auto-play is handled on the website.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Thumbnail (Optional)
          </label>
          <div className="space-y-3">
            {/* File Upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Upload Thumbnail Image (or use URL below)
              </label>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition text-sm"
              />
              {thumbnailFile && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-600">{thumbnailFile.name}</span>
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              {thumbnailPreview && (
                <div className="mt-2 relative w-full max-w-xs">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-full h-32 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>
            
            {/* URL Input */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Or Enter Thumbnail URL
              </label>
              <input
                type="url"
                value={form.thumbnail}
                onChange={(e) => {
                  setForm({ ...form, thumbnail: e.target.value });
                  if (e.target.value && !thumbnailFile) {
                    setThumbnailPreview(e.target.value);
                  }
                }}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
                placeholder="https://example.com/thumbnail.jpg"
                disabled={!!thumbnailFile}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Link Product (Optional)
          </label>
          <select
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
          >
            <option value="">No product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Discount % (Optional)
            </label>
            <input
              type="number"
              value={form.discountPct}
              onChange={(e) => setForm({ ...form, discountPct: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
              min="0"
              max="99"
              placeholder="48"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Order (Display order)
            </label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
              min="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Placement
            </label>
            <select
              value={form.placement}
              onChange={(e) => setForm({ ...form, placement: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
            >
              <option value="home">Home</option>
              <option value="about">About</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Platform
            </label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition"
            >
              <option value="native">Native (Video URL)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status
            </label>
            <div className="flex items-center gap-2 h-[42px] px-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-black rounded focus:ring-black"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isTrending"
              checked={form.isTrending}
              onChange={(e) => setForm({ ...form, isTrending: e.target.checked })}
              className="w-4 h-4 text-black rounded focus:ring-black"
            />
            <span className="text-sm text-gray-700">Trending (highlight badge)</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isFeatured"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              className="w-4 h-4 text-black rounded focus:ring-black"
            />
            <span className="text-sm text-gray-700">Featured (center video - auto-plays, only one can be featured)</span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-gray-200">
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-white py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              )}
              {reel ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
