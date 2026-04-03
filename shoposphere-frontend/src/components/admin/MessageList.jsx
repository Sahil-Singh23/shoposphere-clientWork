import { API } from "../../api";
import AdminTable from "./AdminTable";
import { useToast } from "../../context/ToastContext";

export default function MessageList({ messages, onUpdate }) {
  const toast = useToast();
  const markAsRead = async (messageId) => {
    try {
      const res = await fetch(`${API}/contact/${messageId}/read`, {
        method: "PATCH",
        credentials: "include",
      });

      if (res.ok) {
        toast.success("Marked as read");
        onUpdate();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to update message");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update message");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm("Delete this message?")) return;

    try {
      const res = await fetch(`${API}/contact/${messageId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        toast.success("Message deleted");
        onUpdate();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "Failed to delete message");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete message");
    }
  };

  if (messages.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-200">
        <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
        <p className="text-gray-600 font-medium">No messages yet.</p>
      </div>
    );
  }

  const columns = [
    {
      key: "from",
      header: "From",
      render: (m) => (
        <div>
          <div className="font-semibold text-gray-900 flex items-center gap-2">
            {m.name}
            {!m.read && (
              <span className="inline-block px-2 py-0.5 text-xs bg-pink-500 text-white rounded-full font-semibold">
                New
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">{m.email}</div>
          {m.phone && <div className="text-xs text-gray-500">{m.phone}</div>}
        </div>
      ),
      searchText: (m) => `${m.name || ""} ${m.email || ""} ${m.phone || ""} ${m.read ? "read" : "new"}`,
    },
    {
      key: "message",
      header: "Message",
      render: (m) => (
        <div className="text-sm text-gray-700 line-clamp-3 max-w-[32rem]">
          {m.message}
        </div>
      ),
      searchText: (m) => m.message || "",
    },
    {
      key: "date",
      header: "Date",
      render: (m) => (
        <span className="text-sm text-gray-600">
          {new Date(m.createdAt).toLocaleDateString()}
        </span>
      ),
      searchText: (m) => String(m.createdAt || ""),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => (
        <span
          className={`inline-block px-2 py-1 text-xs rounded-full font-semibold ${
            m.read ? "bg-gray-100 text-gray-700" : "bg-pink-100 text-pink-700"
          }`}
        >
          {m.read ? "Read" : "New"}
        </span>
      ),
      searchText: (m) => (m.read ? "read" : "new"),
    },
  ];

  return (
    <AdminTable
      title="Contact Messages"
      items={messages}
      columns={columns}
      getRowId={(m) => m.id}
      actions={(message) => (
        <div className="flex gap-2">
          {!message.read && (
            <button
              onClick={() => markAsRead(message.id)}
              className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-sm font-semibold hover:bg-pink-600 transition"
            >
              Mark Read
            </button>
          )}
          <button
            onClick={() => deleteMessage(message.id)}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
          >
            Delete
          </button>
        </div>
      )}
      emptyState={
        <>
          <img src="/logo.png" alt="Gift Choice Logo" className="w-20 h-20 mx-auto mb-4 object-contain opacity-50" />
          <p className="text-gray-600 font-medium">No messages yet.</p>
        </>
      }
    />
  );
}
