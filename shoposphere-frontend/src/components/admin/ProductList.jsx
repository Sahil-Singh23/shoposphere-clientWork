import { API } from "../../api";
import { useToast } from "../../context/ToastContext";
import OrderableList from "./OrderableList";

// Build a clone for "Duplicate" (no id so form treats as new product)
function cloneProductForDuplicate(product) {
  const images = product.images
    ? Array.isArray(product.images)
      ? product.images
      : typeof product.images === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(product.images);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : []
    : [];
  const videos = product.videos && Array.isArray(product.videos) ? product.videos : [];
  return {
    ...product,
    id: null,
    name: (product.name || "").trim() + " (Copy)",
    images,
    videos,
    sizes:
      product.sizes && product.sizes.length > 0
        ? product.sizes.map((s) => ({
            label: s.label,
            price: s.price,
            originalPrice: s.originalPrice ?? null,
          }))
        : [],
    weightOptions: product.weightOptions
      ? (() => {
          try {
            const weights = Array.isArray(product.weightOptions)
              ? product.weightOptions
              : JSON.parse(product.weightOptions);
            return JSON.stringify(
              weights.map((w) => ({
                weight: w.weight,
                price: w.price,
                originalPrice: w.originalPrice ?? null,
              }))
            );
          } catch {
            return null;
          }
        })()
      : null,
    categories: product.categories || [],
  };
}

export default function ProductList({ products, onEdit, onDelete }) {
  const toast = useToast();
  
  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];

  const handleDelete = async (productId) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`${API}/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        toast.success("Product deleted");
        onDelete();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to delete product");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete product");
    }
  };

  // Sort products by order
  const sortedProducts = [...safeProducts].sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderRow = (product, order, dragHandle, orderInput, isDragging) => {
    const images = product.images
      ? Array.isArray(product.images)
        ? product.images
        : JSON.parse(product.images)
      : [];

    return (
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
          {images.length > 0 ? (
            <img
              src={images[0]}
              alt={product.name}
              className="w-14 h-14 object-cover rounded-lg"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'oklch(92% .04 340)' }}>
              <img src="/logo.png" alt="Gift Choice Logo" className="w-10 h-10 object-contain opacity-50" />
            </div>
          )}
        </div>

        {/* Name & Details */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold" style={{ color: 'oklch(20% .02 340)' }}>
            {product.name}
          </div>
          <div className="text-xs line-clamp-1" style={{ color: 'oklch(50% .02 340)' }}>
            {product.description}
          </div>
          <div className="text-xs mt-1" style={{ color: 'oklch(50% .02 340)' }}>
            {product.categories && product.categories.length > 0
              ? product.categories.map(c => c.name || c.category?.name).join(", ")
              : product.category?.name || "No category"}
          </div>
          {/* Weight and Size Info */}
          <div className="text-xs mt-1 flex gap-2 flex-wrap">
            {product.weightOptions ? (
              (() => {
                try {
                  const weights = Array.isArray(product.weightOptions) 
                    ? product.weightOptions 
                    : JSON.parse(product.weightOptions);
                  return (
                    <span style={{ color: 'oklch(55% .02 340)' }}>
                      <strong>Weights:</strong> {weights.map(w => w.weight).join(", ")}
                    </span>
                  );
                } catch {
                  return null;
                }
              })()
            ) : product.sizes && product.sizes.length > 0 ? (
              <span style={{ color: 'oklch(55% .02 340)' }}>
                <strong>Sizes:</strong> {product.sizes.map(s => s.label).join(", ")}
              </span>
            ) : product.hasSinglePrice ? (
              <span style={{ color: 'oklch(55% .02 340)' }}>
                <strong>Type:</strong> Single Price
              </span>
            ) : null}
            {/* Inventory / Stock */}
            <span style={{ color: typeof product.stock === 'number' && product.stock <= 5 ? 'oklch(50% .2 25)' : 'oklch(55% .02 340)' }}>
              <strong>Stock:</strong> {typeof product.stock === 'number' ? product.stock : 0}
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex-shrink-0">
          <div className="flex flex-wrap gap-1">
            {product.isFestival && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded-full font-semibold">
                Festival
              </span>
            )}
            {product.isNew && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded-full font-semibold">
                New
              </span>
            )}
            {product.isTrending && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded-full font-semibold">
                Trending
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-2 flex-wrap">
          <button
            onClick={() => onEdit(product)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
            style={{ backgroundColor: 'oklch(92% .04 340)', color: 'oklch(20% .02 340)' }}
            onMouseEnter={(e) => !isDragging && (e.target.style.backgroundColor = 'oklch(88% .06 340)')}
            onMouseLeave={(e) => (e.target.style.backgroundColor = 'oklch(92% .04 340)')}
          >
            Edit
          </button>
          <button
            onClick={() => onEdit(cloneProductForDuplicate(product))}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition border"
            style={{ borderColor: 'oklch(70% .06 340)', color: 'oklch(40% .02 340)' }}
            onMouseEnter={(e) => {
              if (!isDragging) {
                e.target.style.backgroundColor = 'oklch(96% .02 340)';
                e.target.style.borderColor = 'oklch(60% .06 340)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '';
              e.target.style.borderColor = 'oklch(70% .06 340)';
            }}
          >
            Duplicate
          </button>
          <button
            onClick={() => handleDelete(product.id)}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  const renderOrderInput = (product, currentOrder, inputValue, onChange, onBlur) => (
    <input
      type="number"
      min="1"
      max={sortedProducts.length}
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
      items={sortedProducts}
      onReorder={() => {
        // Refresh list after reorder
        if (onDelete) onDelete();
      }}
      reorderEndpoint="/products/reorder"
      getItemId={(p) => p.id}
      renderRow={renderRow}
      renderOrderInput={renderOrderInput}
      title="All Products"
      emptyState={
        <>
          <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
          <p className="text-gray-600 font-medium">No products yet. Add your first product above!</p>
        </>
      }
    />
  );
}
