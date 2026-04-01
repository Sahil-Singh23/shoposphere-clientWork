import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../api";
import ProductCard from "./ProductCard";

const WHATSAPP_LINK = "https://wa.me/917976948872?text=" + encodeURIComponent("Hello! I need assistance with GiftChoice.");

const WELCOME_MESSAGE = {
  id: "welcome",
  text: `👋 Hi! I'm Gift Buddy 🎁\nYour personal gift assistant.\nLooking for the perfect gift today?`,
  sender: "bot",
  timestamp: new Date(),
  quickOptions: [
    { label: "🎂 Birthday Gifts", value: "Birthday gifts" },
    { label: "💍 Anniversary / Wedding Gifts", value: "Anniversary or wedding gifts" },
    { label: "❤️ Gifts for Loved Ones", value: "Gifts for loved ones" },
    { label: "🧸 Kids Gifts", value: "Gifts for kids" },
    { label: "🏢 Corporate / Bulk Gifts", value: "Corporate or bulk gifts" },
    { label: "💰 Gifts by Budget", value: "Gifts by budget - help me choose" },
    { label: "✍️ Type your requirement", value: "" },
  ],
};

export default function ChatBot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const conversationRef = useRef([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendToApi = async (userText) => {
    if (!userText?.trim()) return;

    const userMsg = {
      id: Date.now(),
      text: userText.trim(),
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    conversationRef.current = [
      ...conversationRef.current,
      { role: "user", content: userText.trim() },
    ];
    setInputMessage("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationRef.current }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errText = (data.error || "").toLowerCase();
        if (res.status === 429 || errText.includes("quota") || errText.includes("billing")) {
          setIsOpen(false);
          navigate("/categories?trending=true");
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }

      const botMsg = {
        id: Date.now() + 1,
        text: data.message || "I'm here to help! What are you looking for?",
        sender: "bot",
        timestamp: new Date(),
        products: data.products || [],
      };
      setMessages((prev) => [...prev, botMsg]);
      conversationRef.current = [
        ...conversationRef.current,
        { role: "assistant", content: data.message },
      ];
    } catch (err) {
      const errMsg = err.message || "I'm syncing the latest gifts right now 😊 Meanwhile, you can chat with me directly on WhatsApp for quick help 🎁";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: errMsg,
          sender: "bot",
          timestamp: new Date(),
          action: "whatsapp",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text && !loading) return;
    if (text) sendToApi(text);
  };

  const handleQuickOption = (opt) => {
    if (opt.value === "") {
      return;
    }
    sendToApi(opt.value);
  };

  const handleAction = (action) => {
    if (action === "whatsapp") {
      window.open(WHATSAPP_LINK, "_blank");
    }
  };

  const quickActions = [
    { label: "Browse Products", action: () => navigate("/categories") },
    { label: "Chat on WhatsApp", action: () => window.open(WHATSAPP_LINK, "_blank") },
  ];

  return (
    <>
      {/* Floating button - responsive positioning */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 rounded-full w-14 h-14 md:w-16 md:h-16 shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center group active:scale-95"
        style={{ backgroundColor: "oklch(92% .04 340)" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "oklch(88% .06 340)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "oklch(92% .04 340)")}
      >
        {!isOpen ? (
          <img 
            src="/model.png" 
            alt="Gift Buddy" 
            className="w-10 h-10"
          />
        ) : (
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "oklch(20% .02 340)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>

      {/* Chat window - responsive layout */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 md:bottom-24 md:right-8 md:left-auto z-50 w-full md:w-96 h-[100dvh] md:h-[600px] bg-white md:rounded-2xl shadow-2xl flex flex-col border-2 md:border-2 border-t-2 overflow-hidden"
          style={{ borderColor: "oklch(92% .04 340)" }}
        >
          {/* Header - responsive padding */}
          <div
            className="p-3 md:p-4 border-b-2 flex items-center justify-between shrink-0"
            style={{ borderColor: "oklch(92% .04 340)", backgroundColor: "oklch(92% .04 340)" }}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: "oklch(88% .06 340)" }}>
                <img 
                  src="/model.png" 
                  alt="Gift Buddy" 
                  className="w-10 h-10"
                />
              </div>
              <div>
                <h3 className="font-bold text-sm md:text-base" style={{ color: "oklch(20% .02 340)" }}>
                  Gift Buddy
                </h3>
                <p className="text-xs" style={{ color: "oklch(60% .02 340)" }}>
                  Your personal gift assistant
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/50 transition">
              <svg className="w-5 h-5" style={{ color: "oklch(20% .02 340)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages - responsive padding and spacing */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4" style={{ backgroundColor: "white" }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] md:max-w-[90%] rounded-2xl px-3 md:px-4 py-2 ${
                    msg.sender === "user" ? "rounded-br-sm" : "rounded-bl-sm"
                  }`}
                  style={{
                    backgroundColor: msg.sender === "user" ? "oklch(92% .04 340)" : "oklch(96% .02 340)",
                    color: "oklch(20% .02 340)",
                  }}
                >
                  <p className="text-xs md:text-sm whitespace-pre-line">{msg.text}</p>
                  {msg.quickOptions && msg.sender === "bot" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.quickOptions.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuickOption(opt)}
                          disabled={loading || opt.value === ""}
                          className="px-2 md:px-2.5 py-1 rounded-full text-[10px] md:text-xs font-medium transition disabled:opacity-50"
                          style={{ backgroundColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.products.map((p) => (
                        <ProductCard key={p.id} product={p} compact />
                      ))}
                    </div>
                  )}
                  {msg.action === "whatsapp" && (
                    <button
                      onClick={() => handleAction("whatsapp")}
                      className="mt-2 px-2.5 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-semibold w-full"
                      style={{ backgroundColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
                    >
                      Chat on WhatsApp
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-sm px-3 md:px-4 py-2"
                  style={{ backgroundColor: "oklch(96% .02 340)", color: "oklch(20% .02 340)" }}
                >
                  <span className="inline-block w-3 h-3 md:w-4 md:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-xs md:text-sm">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions - responsive and scrollable on mobile */}
          <div
            className="p-2 md:p-3 border-t-2 flex gap-1.5 md:gap-2 overflow-x-auto shrink-0 scrollbar-hide"
            style={{ borderColor: "oklch(92% .04 340)", backgroundColor: "oklch(96% .02 340)" }}
          >
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.action}
                className="px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-semibold whitespace-nowrap transition-all"
                style={{ backgroundColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Input form - responsive padding and sizing */}
          <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t-2 shrink-0" style={{ borderColor: "oklch(92% .04 340)" }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 md:px-4 py-2 md:py-2.5 rounded-full text-xs md:text-sm border-2 focus:outline-none transition"
                style={{ borderColor: "oklch(92% .04 340)", backgroundColor: "white", color: "oklch(20% .02 340)" }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 md:px-4 py-2 md:py-2.5 rounded-full font-semibold transition hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
                style={{ backgroundColor: "oklch(92% .04 340)", color: "oklch(20% .02 340)" }}
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 2 9 18z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
