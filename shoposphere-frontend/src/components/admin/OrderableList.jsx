import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { API } from "../../api";
import { useToast } from "../../context/ToastContext";

// Sortable row component
function SortableRow({ item, renderRow, getItemId, isDragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isItemDragging,
  } = useSortable({ id: getItemId(item) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isItemDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {renderRow(item, listeners, isItemDragging)}
    </div>
  );
}

// Drag handle icon
function DragHandle({ listeners }) {
  return (
    <button
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded transition-colors"
      aria-label="Drag to reorder"
      type="button"
    >
      <svg
        className="w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 8h16M4 16h16"
        />
      </svg>
    </button>
  );
}

export default function OrderableList({
  items,
  onReorder,
  reorderEndpoint,
  getItemId,
  renderRow,
  renderOrderInput,
  title,
  emptyState,
  className = "",
}) {
  const toast = useToast();
  const [activeId, setActiveId] = useState(null);
  const [localItems, setLocalItems] = useState(items);
  const [saving, setSaving] = useState(false);
  const [orderInputs, setOrderInputs] = useState({});

  // Update local items when props change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localItems.findIndex((item) => getItemId(item) === active.id);
    const newIndex = localItems.findIndex((item) => getItemId(item) === over.id);

    const newItems = arrayMove(localItems, oldIndex, newIndex);
    
    // Update order values
    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setLocalItems(reorderedItems);
    await saveOrder(reorderedItems);
  };

  const handleOrderInputChange = (itemId, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) return;

    setOrderInputs((prev) => ({ ...prev, [itemId]: numValue }));
  };

  const handleOrderInputBlur = async (itemId, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
      setOrderInputs((prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }));
      return;
    }

    // Reorder items based on new position
    const itemIndex = localItems.findIndex((item) => getItemId(item) === itemId);
    if (itemIndex === -1) return;

    const newItems = [...localItems];
    const [movedItem] = newItems.splice(itemIndex, 1);
    
    // Insert at new position (0-indexed, so subtract 1)
    const insertIndex = Math.min(Math.max(0, numValue - 1), newItems.length);
    newItems.splice(insertIndex, 0, movedItem);

    // Update order values
    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setLocalItems(reorderedItems);
    setOrderInputs((prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    }));
    await saveOrder(reorderedItems);
  };

  const saveOrder = async (itemsToSave) => {
    if (!reorderEndpoint) {
      // If no endpoint provided, just call onReorder callback
      if (onReorder) {
        onReorder(itemsToSave);
      }
      return;
    }

    setSaving(true);
    try {
      const orderData = itemsToSave.map((item, index) => ({
        id: getItemId(item),
        order: index + 1,
      }));

      const res = await fetch(`${API}${reorderEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ items: orderData }),
      });

      if (res.ok) {
        toast.success("Order updated successfully");
        if (onReorder) {
          onReorder(itemsToSave);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to update order");
        // Revert to original items
        setLocalItems(items);
      }
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Failed to update order. Please try again.");
      // Revert to original items
      setLocalItems(items);
    } finally {
      setSaving(false);
    }
  };

  const activeItem = activeId
    ? localItems.find((item) => getItemId(item) === activeId)
    : null;

  if (localItems.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-md p-12 text-center border ${className}`} style={{ borderColor: 'oklch(92% .04 340)' }}>
        {emptyState || (
          <>
            <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
            <p className="text-gray-600 font-medium">No items yet.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-md border ${className}`} style={{ borderColor: 'oklch(92% .04 340)' }}>
      <div className="p-6 border-b" style={{ borderColor: 'oklch(92% .04 340)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: 'oklch(20% .02 340)' }}>
            {title || "Items"} ({localItems.length})
          </h2>
          {saving && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'oklch(50% .02 340)' }}>
              <span className="inline-block w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              Saving order...
            </div>
          )}
        </div>
        <p className="text-sm mt-1" style={{ color: 'oklch(50% .02 340)' }}>
          Drag items to reorder or change the order number directly
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localItems.map((item) => getItemId(item))}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y" style={{ borderColor: 'oklch(92% .04 340)' }}>
            {localItems.map((item, index) => (
              <SortableRow
                key={getItemId(item)}
                item={item}
                renderRow={(item, dragListeners, isDragging) =>
                  renderRow(
                    item,
                    index + 1,
                    <DragHandle listeners={dragListeners} />,
                    renderOrderInput
                      ? renderOrderInput(
                          item,
                          index + 1,
                          orderInputs[getItemId(item)] || item.order || index + 1,
                          (value) => handleOrderInputChange(getItemId(item), value),
                          (value) => handleOrderInputBlur(getItemId(item), value)
                        )
                      : null,
                    isDragging
                  )
                }
                getItemId={getItemId}
                isDragging={activeId === getItemId(item)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <div className="bg-white border-2 rounded-lg p-4 shadow-lg" style={{ borderColor: 'oklch(92% .04 340)' }}>
              {renderRow(activeItem, localItems.indexOf(activeItem) + 1, null, null, true)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
