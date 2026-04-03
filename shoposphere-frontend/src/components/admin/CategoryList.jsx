import { API } from "../../api";
import { useToast } from "../../context/ToastContext";
import OrderableList from "./OrderableList";

export default function CategoryList({ categories, onEdit, onDelete }) {
  const toast = useToast();
  
  const handleDelete = async (categoryId) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const res = await fetch(`${API}/categories/${categoryId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        toast.success("Category deleted");
        onDelete();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to delete category");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete category");
    }
  };

  // Sort categories by order
  const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderRow = (category, order, dragHandle, orderInput, isDragging) => (
    <div
      className={`flex items-center gap-4 p-4 transition-all ${isDragging ? "opacity-50" : ""}`}
      style={{ backgroundColor: "transparent" }}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {/* Drag Handle */}
      <div className="flex-shrink-0">{dragHandle}</div>

      {/* Order Input */}
      <div className="flex-shrink-0 w-20">
        {orderInput || (
          <div className="text-center">
            <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {order}
            </div>
          </div>
        )}
      </div>

      {/* Image */}
      <div className="flex-shrink-0">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-14 h-14 object-cover rounded-lg"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--secondary)" }}>
            <img src="/logo.png" alt="SK Fruits" className="w-10 h-10 object-contain opacity-50" />
          </div>
        )}
      </div>

      {/* Name & Details */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ color: "var(--foreground)" }}>
          {category.name}
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Slug: {category.slug}
        </div>
      </div>

      {/* Products Count */}
      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-semibold" style={{ color: 'oklch(92% .04 340)' }}>
          {category._count?.products || 0} products
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2">
        <button
          onClick={() => onEdit(category)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
          style={{ backgroundColor: 'oklch(92% .04 340)', color: 'oklch(20% .02 340)' }}
          onMouseEnter={(e) => !isDragging && (e.target.style.backgroundColor = 'oklch(88% .06 340)')}
          onMouseLeave={(e) => (e.target.style.backgroundColor = 'oklch(92% .04 340)')}
        >
          Edit
        </button>
        <button
          onClick={() => handleDelete(category.id)}
          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const renderOrderInput = (category, currentOrder, inputValue, onChange, onBlur) => (
    <input
      type="number"
      min="1"
      max={sortedCategories.length}
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
      items={sortedCategories}
      onReorder={() => {
        // Refresh list after reorder
        if (onDelete) onDelete();
      }}
      reorderEndpoint="/categories/reorder"
      getItemId={(c) => c.id}
      renderRow={renderRow}
      renderOrderInput={renderOrderInput}
      title="All Categories"
      emptyState={
        <>
          <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
          <p className="text-gray-600 font-medium">No categories yet. Add your first category above!</p>
        </>
      }
    />
  );
}
