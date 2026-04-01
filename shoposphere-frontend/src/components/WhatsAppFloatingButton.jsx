export default function WhatsAppFloatingButton() {
  const buildHref = () => {
    const phone = "917976948872";
    let productName = "";
    let priceText = "";

    try {
      productName = localStorage.getItem("skfruits_last_whatsapp_product") || "";
      priceText = localStorage.getItem("skfruits_last_whatsapp_price") || "";
    } catch {
      // ignore
    }

    const msg = productName
      ? `Hi! I want to order ${productName}. ${priceText || ""} Please share available options and delivery details.`
      : "Hello! I need assistance";

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <button
      type="button"
      aria-label="Order on WhatsApp"
      title="Order on WhatsApp"
      onClick={() => window.open(buildHref(), "_blank", "noopener,noreferrer")}
      className="fixed bottom-23 md:bottom-6 right-6 z-50 w-[52px] h-[52px] md:w-[56px] md:h-[56px] rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center"
      style={{
        backgroundColor: "var(--accent)",
        color: "white",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = "brightness(0.98)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
      }}
    >
      {/* WhatsApp icon */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M19.11 17.52c-.16-.08-.97-.48-1.12-.54-.15-.06-.26-.08-.37.08-.1.16-.42.54-.51.65-.1.1-.19.12-.35.04-.16-.08-.68-.25-1.3-.8-.48-.43-.8-.96-.9-1.13-.09-.16-.01-.25.07-.33.08-.08.16-.19.25-.28.08-.1.1-.16.15-.27.05-.11.02-.21-.02-.29-.04-.08-.37-.95-.51-1.29-.14-.34-.29-.29-.39-.3h-.34c-.11 0-.29.04-.44.19-.15.15-.57.56-.57 1.36 0 .8.58 1.57.66 1.68.08.11 1.13 1.72 2.74 2.41.38.17.68.27.91.35.38.12.72.1.99.06.31-.05.97-.4 1.11-.79.14-.39.14-.72.1-.79-.04-.08-.15-.12-.31-.2Z"
        />
        <path
          fill="currentColor"
          d="M16.03 4.78c-6.21 0-11.25 5.04-11.25 11.25 0 2.02.55 3.96 1.59 5.66l-1.07 3.94 4.07-1.05c1.64.9 3.49 1.37 5.39 1.37 6.21 0 11.25-5.04 11.25-11.25S22.24 4.78 16.03 4.78Zm0 20.02c-1.75 0-3.44-.46-4.91-1.34l-.35-.21-2.53.65.65-2.46-.22-.36c-.94-1.5-1.44-3.25-1.44-5.03 0-5.02 4.09-9.11 9.11-9.11s9.11 4.09 9.11 9.11-4.09 9.11-9.11 9.11Z"
        />
      </svg>
    </button>
  );
}

