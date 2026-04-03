import { API } from "../../api";
import AdminTable from "./AdminTable";
import { useToast } from "../../context/ToastContext";

export default function OrderList({ orders, onUpdate }) {
  const toast = useToast();
  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success("Order updated");
        onUpdate();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to update order");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update order");
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-200">
        <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
        <p className="text-gray-600 font-medium">No orders yet.</p>
      </div>
    );
  }

  const columns = [
    {
      key: "id",
      header: "Order",
      render: (order) => (
        <div>
          <div className="font-semibold text-gray-900 flex flex-wrap items-center gap-2">
            <span>#{order.id}</span>
          </div>
          <div className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleDateString()}{" "}
            {new Date(order.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ),
      searchText: (o) => `#${o.id} ${o.createdAt || ""}`,
    },
    {
      key: "customer",
      header: "Customer",
      render: (order) => (
        <div className="text-sm">
          <div className="font-semibold text-gray-900">{order.customer || "—"}</div>
          {order.phone && <div className="text-xs text-gray-500">{order.phone}</div>}
          {order.email && <div className="text-xs text-gray-500">{order.email}</div>}
        </div>
      ),
      searchText: (o) => `${o.customer || ""} ${o.phone || ""} ${o.email || ""}`,
    },
    {
      key: "total",
      header: "Total",
      render: (order) => (
        <span className="font-bold text-pink-600">₹{order.total?.toFixed(2) || "0.00"}</span>
      ),
      searchText: (o) => String(o.total ?? ""),
    },
    {
      key: "status",
      header: "Status",
      render: (order) => (
        <select
          value={order.status === "shipped" ? "out_for_delivery" : (order.status || "pending")}
          onChange={(e) => updateStatus(order.id, e.target.value)}
          className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-500 transition bg-white"
        >
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ),
      searchText: (o) => o.status || "pending",
    },
    {
      key: "items",
      header: "Items",
      render: (order) => (
        <div className="text-xs text-gray-600">
          {(order.items || []).slice(0, 2).map((item, idx) => (
            <div key={idx} className="truncate max-w-[18rem]">
              {item.productName} ({item.sizeLabel}) × {item.quantity}
            </div>
          ))}
          {(order.items || []).length > 2 && (
            <div className="text-gray-500">+{(order.items || []).length - 2} more</div>
          )}
        </div>
      ),
      searchText: (o) =>
        (o.items || [])
          .map((i) => `${i.productName || ""} ${i.sizeLabel || ""} ${i.quantity || ""}`)
          .join(" "),
    },
  ];

  return (
    <AdminTable
      title="All Orders"
      items={orders}
      columns={columns}
      getRowId={(o) => o.id}
      emptyState={
        <>
          <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
          <p className="text-gray-600 font-medium">No orders yet.</p>
        </>
      }
    />
  );
}
