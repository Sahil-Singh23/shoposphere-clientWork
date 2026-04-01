import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function Contact() {
  const navigate = useNavigate();

  const contact = useMemo(
    () => ({
      brand: "Shoposphere",
      repName: "Yash Jhanwar",
      phoneDisplay: "63778 02798",
      phoneE164: "+916377802798",
      hours: "10AM – 6PM",
      email: "Shoposphere.in@gmail.com",
      addressTitle: "Bhilwara Furniture House",
      addressLine:
        "Near Sitaram Ji Ki Bawri, Bhilwara, 311001 – Rajasthan",
      instagram: "Shoposphere.in",
      whatsappE164: "+916377802798",
      mapQuery:
        "Bhilwara Furniture House Near Sitaram Ji Ki Bawri Bhilwara Rajasthan 311001",
    }),
    []
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full grid place-items-center border border-design bg-card hover:shadow-sm active:scale-95"
            style={{ borderColor: "var(--border)" }}
            aria-label="Go back"
          >
            <span aria-hidden style={{ color: "var(--foreground)" }}>
              ←
            </span>
          </button>
          <div className="text-sm sm:text-base font-medium" style={{ color: "var(--foreground)" }}>
            Contact Us
          </div>
        </div>

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="text-xs tracking-widest uppercase mb-3" style={{ color: "var(--foreground-muted)" }}>
              Get in touch
            </div>
            <div className="leading-tight">
              <div className="text-4xl sm:text-5xl font-semibold" style={{ color: "var(--foreground)" }}>
                {contact.brand}
              </div>
              <div className="text-4xl sm:text-5xl font-semibold" style={{ color: "var(--foreground-muted)" }}>
                Concierge.
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-base max-w-md text-muted">
              Experience seamless support tailored to your editorial lifestyle. We’re here to assist with
              orders, inquiries, and aesthetic consultations.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <a
                href={`tel:${contact.phoneE164}`}
                className="px-6 py-3 rounded-full font-semibold text-center shadow-sm active:scale-[0.99]"
                style={{ backgroundColor: "#111111", color: "#ffffff" }}
              >
                Call Now
              </a>
              <a
                href={`https://wa.me/${contact.whatsappE164.replace("+", "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-full font-semibold text-center border bg-card hover:shadow-sm active:scale-[0.99]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Chat via WhatsApp
              </a>
            </div>
          </div>

          {/* Info cards */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-soft p-5 sm:p-6">
                <div className="text-xs tracking-widest uppercase mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Representative
                </div>
                <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  {contact.repName}
                </div>
              </div>

              <div className="card-soft p-5 sm:p-6">
                <div className="text-xs tracking-widest uppercase mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Mobile number
                </div>
                <a
                  href={`tel:${contact.phoneE164}`}
                  className="text-lg font-semibold hover:underline"
                  style={{ color: "var(--foreground)" }}
                >
                  {contact.phoneDisplay}
                </a>
              </div>

              <div className="card-soft p-5 sm:p-6">
                <div className="text-xs tracking-widest uppercase mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Working hours
                </div>
                <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  {contact.hours}
                </div>
              </div>

              <div className="card-soft p-5 sm:p-6">
                <div className="text-xs tracking-widest uppercase mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Email address
                </div>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-lg font-semibold hover:underline break-words"
                  style={{ color: "var(--foreground)" }}
                >
                  {contact.email}
                </a>
              </div>

              <div className="card-soft p-5 sm:p-6 sm:col-span-2">
                <div className="text-xs tracking-widest uppercase mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Physical address
                </div>
                <div className="text-sm sm:text-base font-semibold" style={{ color: "var(--foreground)" }}>
                  {contact.addressTitle}, {contact.addressLine}
                </div>
              </div>

              <div className="card-soft p-5 sm:p-6 sm:col-span-2 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-end">
                  <div className="md:col-span-5">
                    <div
                      className="text-xs tracking-widest uppercase mb-2"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Instagram
                    </div>
                    <a
                      href={`https://instagram.com/${contact.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-lg font-semibold hover:underline"
                      style={{ color: "var(--foreground)" }}
                    >
                      {contact.instagram}
                    </a>
                  </div>
                  <div className="md:col-span-7">
                    <div
                      className="rounded-xl border"
                      style={{
                        borderColor: "var(--border)",
                        background:
                          "linear-gradient(135deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.0) 60%)",
                        height: 90,
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Showroom */}
        <div className="mt-10 sm:mt-14">
          <div className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            Visit Our Showroom
          </div>
          <div className="text-sm sm:text-base text-muted mb-4">
            Find us in the heart of Rajasthan’s textile hub.
          </div>

          <div className="relative overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <div className="h-[240px] sm:h-[320px] lg:h-[380px]" style={{ backgroundColor: "var(--muted)" }}>
              <iframe
                title="Shoposphere Showroom Map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(contact.mapQuery)}&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="absolute left-4 bottom-4 right-4 sm:left-6 sm:bottom-6 sm:right-auto">
              <div
                className="bg-card border rounded-2xl px-4 py-3 shadow-sm max-w-md"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {contact.addressTitle}
                </div>
                <div className="text-xs sm:text-sm text-muted">{contact.addressLine}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(contact.mapQuery)}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl font-semibold text-center border bg-card hover:shadow-sm active:scale-[0.99]"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Open in Google Maps
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="px-5 py-3 rounded-xl font-semibold text-center btn-primary-brand active:scale-[0.99]"
            >
              Email us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
