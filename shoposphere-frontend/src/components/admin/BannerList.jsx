import { API } from "../../api";
import { useToast } from "../../context/ToastContext";
import OrderableList from "./OrderableList";

export default function BannerList({ banners, onEdit, onDelete }) {
  const toast = useToast();
  
  const handleDelete = async (bannerId) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const res = await fetch(`${API}/banners/${bannerId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        toast.success("Banner deleted");
        onDelete();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to delete banner");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete banner");
    }
  };

  // Sort banners by order
  const sortedBanners = [...banners].sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderRow = (banner, order, dragHandle, orderInput, isDragging) => (
    <div
      className={`flex items-center gap-4 p-4 transition-all ${
        isDragging ? "opacity-50" : "hover:bg-gray-50"
      }`}
    >
      {/* Drag Handle */}
      <div className="flex-shrink-0">{dragHandle}</div>

      {/* Order Input */}
      <div className="flex-shrink-0 w-20">
        {orderInput || (
          <div className="text-center">
            <div className="text-sm font-bold" style={{ color: 'oklch(20% .02 340)' }}>
              {order}
            </div>
          </div>
        )}
      </div>

      {/* Image */}
      <div className="flex-shrink-0">
        {banner.imageUrl ? (
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="w-20 h-12 object-cover rounded-lg"
          />
        ) : (
          <div className="w-20 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'oklch(92% .04 340)' }}>
            <img src="/logo.png" alt="Gift Choice Logo" className="h-6 w-auto object-contain opacity-50" />
          </div>
        )}
      </div>

      {/* Title & Details */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ color: 'oklch(20% .02 340)' }}>
          {banner.title}
        </div>
        {banner.subtitle && (
          <div className="text-xs line-clamp-1" style={{ color: 'oklch(50% .02 340)' }}>
            {banner.subtitle}
          </div>
        )}
        {banner.ctaText && banner.ctaLink && (
          <div className="text-xs mt-1" style={{ color: 'oklch(50% .02 340)' }}>
            CTA: {banner.ctaText}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <span
          className={`inline-block px-2 py-1 text-xs rounded-full font-semibold ${
            banner.isActive ? "bg-pink-100 text-pink-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          {banner.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2">
        <button
          onClick={() => onEdit(banner)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
          style={{ backgroundColor: 'oklch(92% .04 340)', color: 'oklch(20% .02 340)' }}
          onMouseEnter={(e) => !isDragging && (e.target.style.backgroundColor = 'oklch(88% .06 340)')}
          onMouseLeave={(e) => (e.target.style.backgroundColor = 'oklch(92% .04 340)')}
        >
          Edit
        </button>
        <button
          onClick={() => handleDelete(banner.id)}
          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const renderOrderInput = (banner, currentOrder, inputValue, onChange, onBlur) => (
    <input
      type="number"
      min="1"
      max={sortedBanners.length}
      value={inputValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      className="w-16 px-2 py-1 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:ring-2 transition"
      style={{
        borderColor: 'oklch(92% .04 340)',
        color: 'oklch(20% .02 340)'
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );

  return (
    <OrderableList
      items={sortedBanners}
      onReorder={() => {
        // Refresh list after reorder
        if (onDelete) onDelete();
      }}
      reorderEndpoint="/banners/reorder"
      getItemId={(b) => b.id}
      renderRow={renderRow}
      renderOrderInput={renderOrderInput}
      title="All Banners"
      emptyState={
        <>
          <img src="/logo.png" alt="Gift Choice Logo" className="h-12 w-auto mx-auto mb-4 object-contain opacity-50" />
          <p className="text-gray-600 font-medium">No banners yet. Add your first banner above!</p>
        </>
      }
    />
  );
}
