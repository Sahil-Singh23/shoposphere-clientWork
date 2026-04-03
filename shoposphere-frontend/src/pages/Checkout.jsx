import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { useUserAuth } from "../context/UserAuthContext";
import { API } from "../api";
import AddressForm from "../components/AddressForm";
import LocationPicker from "../components/LocationPicker";
import { CART_SESSION_KEY } from "../context/CartContext";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const PAYMENT_METHOD_ONLINE = "online";
const PAYMENT_METHOD_COD = "cod";

const initialForm = {
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  email: "",
  latitude: null,
  longitude: null,
};

const initialErrors = { ...initialForm };

function getSessionId() {
  try {
    return localStorage.getItem(CART_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load payment gateway"));
    document.body.appendChild(script);
  });
}

function validatePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10;
}

function validatePincode(value) {
  return /^\d{6}$/.test(value.trim());
}

export default function Checkout() {
  const { cartItems, isLoaded, refreshCart } = useCart();
  const { isAuthenticated } = useUserAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD_ONLINE);
  const [paymentError, setPaymentError] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addAddressModalOpen, setAddAddressModalOpen] = useState(false);
  const [savingNewAddress, setSavingNewAddress] = useState(false);
  const [deliverySummary, setDeliverySummary] = useState(null);
  const [deliverySlots, setDeliverySlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [saveAddressForNextTime, setSaveAddressForNextTime] = useState(true);
  const paymentInProgressRef = useRef(false);
  const usedManualFormRef = useRef(false);

  useEffect(() => {
    refreshCart?.();
  }, [refreshCart]);

  const sessionId = getSessionId();

  useEffect(() => {
    if (!isLoaded || !sessionId) {
      setLoadingSummary(false);
      return;
    }
    setLoadingSummary(true);
    setSummaryError(null);
    const url = selectedSlotId
      ? `${API}/delivery/checkout-summary?slotId=${selectedSlotId}`
      : `${API}/delivery/checkout-summary`;
    fetch(url, { headers: { "X-Cart-Session-Id": sessionId }, credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status === 400 ? "Invalid cart" : "Failed to load"))))
      .then((data) => setDeliverySummary(data))
      .catch((err) => {
        setSummaryError(err.message || "Could not load delivery details");
        setDeliverySummary(null);
      })
      .finally(() => setLoadingSummary(false));
  }, [isLoaded, sessionId, cartItems.length, selectedSlotId]);

  const fetchSlots = () => {
    setLoadingSlots(true);
    setSlotsError(false);
    fetch(`${API}/delivery/slots?days=7`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data) => setDeliverySlots(data.slots || []))
      .catch(() => {
        setDeliverySlots([]);
        setSlotsError(true);
      })
      .finally(() => setLoadingSlots(false));
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingAddresses(true);
    fetch(`${API}/addresses`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const defaultAddr = list.find((a) => a.isDefault) || list[0];
        setSelectedAddressId(defaultAddr ? defaultAddr.id : null);
      })
      .catch(() => setAddresses([]))
      .finally(() => setLoadingAddresses(false));
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    if (isLoaded && cartItems.length === 0) {
      toast.error("Your cart is empty");
      navigate("/cart", { replace: true });
    }
  }, [isLoaded, cartItems.length, navigate, toast]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const next = { ...initialErrors };
    if (!form.name.trim()) next.name = "Full name is required";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    else if (!validatePhone(form.phone)) next.phone = "Enter a valid 10-digit phone number";
    if (!form.address.trim()) next.address = "Address is required";
    if (!form.city.trim()) next.city = "City is required";
    if (!form.state.trim()) next.state = "State is required";
    if (!form.pincode.trim()) next.pincode = "Pincode is required";
    else if (!validatePincode(form.pincode)) next.pincode = "Pincode must be 6 digits";
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const getCustomerDetails = () => {
    if (isAuthenticated && selectedAddressId && addresses.length) {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      if (addr) {
        return {
          name: addr.fullName,
          phone: addr.phone,
          address: addr.addressLine,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          email: form.email?.trim() || undefined,
          latitude: addr.latitude ?? undefined,
          longitude: addr.longitude ?? undefined,
        };
      }
    }
    return {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      email: form.email?.trim() || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
    };
  };

  const saveAddressToAccount = async (details) => {
    if (!details?.name || !details?.address || !details?.city || !details?.state || !details?.pincode) return;
    try {
      await fetch(`${API}/addresses/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: details.name,
          phone: details.phone || "",
          addressLine: details.address,
          city: details.city,
          state: details.state,
          pincode: details.pincode,
          latitude: details.latitude ?? null,
          longitude: details.longitude ?? null,
          isDefault: addresses.length === 0,
        }),
      });
    } catch {
      // Non-blocking; order already succeeded
    }
  };

  const isSlotOrDeliveryError = (message) => {
    if (!message || typeof message !== "string") return false;
    const lower = message.toLowerCase();
    return lower.includes("slot") || lower.includes("delivery");
  };

  const handleSlotError = () => {
    setSelectedSlotId(null);
    setPaymentError(null);
    fetchSlots();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPaymentError(null);
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    const useManualForm = !isAuthenticated || !selectedAddressId || !addresses.find((a) => a.id === selectedAddressId);
    usedManualFormRef.current = useManualForm;
    if (useManualForm && !validate()) return;
    const sessionId = getSessionId();
    if (!sessionId) {
      toast.error("Session expired. Please add items to cart again.");
      navigate("/cart");
      return;
    }
    if (paymentInProgressRef.current || submitting) return;

    const customerDetails = getCustomerDetails();
    const checkoutData = {
      sessionId,
      customerDetails,
      ...(selectedSlotId != null && { deliverySlotId: selectedSlotId }),
    };

    if (paymentMethod === PAYMENT_METHOD_COD) {
      setSubmitting(true);

      //
      //hitting the razor pay endpoint from here 
      try {
        const res = await fetch(`${API}/orders/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId,
            customerDetails,
            paymentMethod: "cod",
            ...(selectedSlotId != null && { deliverySlotId: selectedSlotId }),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error || "Could not place order";
          setPaymentError(errMsg);
          toast.error(errMsg);
          if (isSlotOrDeliveryError(errMsg)) handleSlotError();
          return;
        }
        if (isAuthenticated && usedManualFormRef.current && saveAddressForNextTime) {
          await saveAddressToAccount(customerDetails);
        }
        navigate(`/order-success?orderId=${data.orderId}`, { replace: true });
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    paymentInProgressRef.current = true;
    try {
      const createRes = await fetch(`${API}/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cart-Session-Id": sessionId,
        },
        body: JSON.stringify({
          sessionId,
          ...(selectedSlotId != null && { deliverySlotId: selectedSlotId }),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        const errMsg = createData.error || "Could not create payment order";
        setPaymentError(errMsg);
        toast.error(errMsg);
        if (isSlotOrDeliveryError(errMsg)) handleSlotError();
        setSubmitting(false);
        paymentInProgressRef.current = false;
        return;
      }

      const { razorpayOrderId, amount, currency } = createData;
      let keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!keyId) {
        try {
          const configRes = await fetch(`${API}/payments/config`);
          const config = await configRes.json();
          keyId = config.razorpayKeyId || "";
        } catch { keyId = ""; }
      }
      if (!keyId) {
        setPaymentError("Payment gateway not configured");
        toast.error("Payment is not available. Try Cash on Delivery.");
        return;
      }

      await loadRazorpayScript();
      const details = getCustomerDetails();

      //options for razor pay 
      
      const options = {
        key: keyId,
        amount: String(amount),
        currency: "INR",
        name: "SK Fruits",
        description: "Order payment",
        order_id: razorpayOrderId,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: false,
          paylater: true,
        },
        prefill: {
          name: details.name || "",
          email: details.email || "",
          contact: details.phone || "",
        },
        theme: {
          color:
            typeof getComputedStyle !== "undefined"
              ? getComputedStyle(document.documentElement).getPropertyValue("--payment-accent").trim() || "#0d9488"
              : "#0d9488",
        },
        modal: {
          ondismiss: () => {
            paymentInProgressRef.current = false;
            setSubmitting(false);
          },
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API}/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                checkoutData,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              const errMsg = verifyData.error || "Payment verification failed";
              setPaymentError(errMsg);
              toast.error(errMsg);
              if (isSlotOrDeliveryError(errMsg)) handleSlotError();
              paymentInProgressRef.current = false;
              setSubmitting(false);
              return;
            }
            if (isAuthenticated && usedManualFormRef.current && saveAddressForNextTime) {
              await saveAddressToAccount(checkoutData.customerDetails);
            }
            paymentInProgressRef.current = false;
            setSubmitting(false);
            navigate(`/order-success?orderId=${verifyData.orderId}`, { replace: true });
          } catch (err) {
            console.error(err);
            setPaymentError("Network error. Your payment may have succeeded; we will confirm shortly.");
            toast.error("Verification failed. If amount was deducted, we will confirm your order shortly.");
            paymentInProgressRef.current = false;
            setSubmitting(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setPaymentError("Payment failed or was cancelled.");
        toast.error("Payment failed or was cancelled. You can try again.");
        paymentInProgressRef.current = false;
        setSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
      paymentInProgressRef.current = false;
      setSubmitting(false);
    }
  };

  const handleAddAddressFromCheckout = async (payload) => {
    setSavingNewAddress(true);
    try {
      const res = await fetch(`${API}/addresses/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not add address");
        return;
      }
      setAddresses((prev) => [...prev, data]);
      setSelectedAddressId(data.id);
      setAddAddressModalOpen(false);
      toast.success("Address added");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingNewAddress(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-10 w-56 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl p-6 animate-pulse h-64" style={{ background: "var(--muted)", border: "1px solid var(--border)" }} />
              <div className="rounded-xl p-6 animate-pulse h-48" style={{ background: "var(--muted)", border: "1px solid var(--border)" }} />
            </div>
            <div className="rounded-xl p-6 animate-pulse h-80" style={{ background: "var(--muted)", border: "1px solid var(--border)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return null;
  }

  const itemCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const fallbackSubtotal = cartItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const subtotal = deliverySummary ? deliverySummary.subtotal : fallbackSubtotal;
  const discountAmount = deliverySummary ? Number(deliverySummary.discountAmount || 0) : 0;
  const deliveryFee = deliverySummary ? deliverySummary.deliveryFee : 0;
  const total = deliverySummary ? deliverySummary.total : Math.max(0, fallbackSubtotal + 0);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold font-display mb-8" style={{ color: "var(--foreground)" }}>
          Checkout
        </h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Delivery + Contact */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1 — Delivery Information */}
            <div
              className="rounded-xl p-6 shadow-sm border"
              style={{ background: "var(--background)", borderColor: "var(--border)" }}
            >
              <h2 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
                Delivery Information
              </h2>

              {isAuthenticated && loadingAddresses ? (
                <div className="space-y-3">
                  <div className="h-20 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
                  <div className="h-20 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
                </div>
              ) : isAuthenticated && addresses.length > 0 ? (
                <>
                  <div className="space-y-3 mb-4">
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setSelectedAddressId(addr.id)}
                        className="w-full text-left rounded-xl p-4 border-2 transition"
                        style={{
                          background: selectedAddressId === addr.id ? "var(--secondary)" : "var(--background)",
                          borderColor: selectedAddressId === addr.id ? "var(--primary)" : "var(--border)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {addr.isDefault && (
                              <span
                                className="inline-block text-xs font-semibold px-2 py-0.5 rounded mb-1"
                                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                              >
                                Default
                              </span>
                            )}
                            <p className="font-semibold" style={{ color: "var(--foreground)" }}>{addr.fullName}</p>
                            <p className="text-sm" style={{ color: "var(--muted)" }}>{addr.phone}</p>
                            <p className="text-sm mt-0.5" style={{ color: "var(--foreground)" }}>
                              {addr.addressLine}, {addr.city}, {addr.state} – {addr.pincode}
                            </p>
                          </div>
                          {selectedAddressId === addr.id && (
                            <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddAddressModalOpen(true)}
                    className="w-full py-3 rounded-xl border-2 border-dashed font-medium"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    + Add new address
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      Full Name <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: errors.name ? "var(--destructive)" : "var(--border)" }}
                      autoComplete="name"
                    />
                    {errors.name && <p className="mt-1 text-sm" style={{ color: "var(--destructive)" }}>{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      Phone Number <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: errors.phone ? "var(--destructive)" : "var(--border)" }}
                      autoComplete="tel"
                    />
                    {errors.phone && <p className="mt-1 text-sm" style={{ color: "var(--destructive)" }}>{errors.phone}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      Search address (optional)
                    </label>
                    <LocationPicker
                      onChange={(data) => {
                        setForm((prev) => ({
                          ...prev,
                          address: data.addressLine || prev.address,
                          city: data.city || prev.city,
                          state: data.state || prev.state,
                          pincode: data.pincode || prev.pincode,
                          latitude: data.latitude ?? prev.latitude,
                          longitude: data.longitude ?? prev.longitude,
                        }));
                        setErrors((prev) => ({ ...prev, address: "", city: "", state: "", pincode: "" }));
                      }}
                      initialLat={form.latitude}
                      initialLng={form.longitude}
                      placeholder="Search address to fill below"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: "var(--border)" }}
                      showMap={true}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      Address Line <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="Street, building, landmark"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: errors.address ? "var(--destructive)" : "var(--border)" }}
                      autoComplete="street-address"
                    />
                    {errors.address && <p className="mt-1 text-sm" style={{ color: "var(--destructive)" }}>{errors.address}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      City <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="City"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: errors.city ? "var(--destructive)" : "var(--border)" }}
                      autoComplete="address-level2"
                    />
                    {errors.city && <p className="mt-1 text-sm" style={{ color: "var(--destructive)" }}>{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      State <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => updateField("state", e.target.value)}
                      placeholder="State"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: errors.state ? "var(--destructive)" : "var(--border)" }}
                      autoComplete="address-level1"
                    />
                    {errors.state && <p className="mt-1 text-sm" style={{ color: "var(--destructive)" }}>{errors.state}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      Pincode <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit pincode"
                      className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                      style={{ background: "var(--background)", borderColor: errors.pincode ? "var(--destructive)" : "var(--border)" }}
                      autoComplete="postal-code"
                    />
                    {errors.pincode && <p className="mt-1 text-sm" style={{ color: "var(--destructive)" }}>{errors.pincode}</p>}
                  </div>
                  {isAuthenticated && (
                    <div className="sm:col-span-2 flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="save-address-checkout"
                        checked={saveAddressForNextTime}
                        onChange={(e) => setSaveAddressForNextTime(e.target.checked)}
                        className="w-4 h-4 rounded border-2"
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="save-address-checkout" className="text-sm cursor-pointer" style={{ color: "var(--foreground)" }}>
                        Save this address for future orders
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery ETA & Fee — backend-driven */}
            <div
              className="rounded-xl p-6 shadow-sm border transition-opacity"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <h2 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
                Delivery
              </h2>
              {loadingSummary ? (
                <div className="space-y-2">
                  <div className="h-12 rounded-lg animate-pulse" style={{ background: "var(--muted)" }} />
                  <div className="h-10 rounded-lg animate-pulse w-2/3" style={{ background: "var(--muted)" }} />
                </div>
              ) : summaryError ? (
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: "var(--destructive)" }}>{summaryError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSummaryError(null);
                      setLoadingSummary(true);
                      const url = selectedSlotId ? `${API}/delivery/checkout-summary?slotId=${selectedSlotId}` : `${API}/delivery/checkout-summary`;
                      fetch(url, { headers: { "X-Cart-Session-Id": sessionId } })
                        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
                        .then((data) => setDeliverySummary(data))
                        .catch((err) => setSummaryError(err.message || "Could not load"))
                        .finally(() => setLoadingSummary(false));
                    }}
                    className="text-sm font-medium underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Try again
                  </button>
                </div>
              ) : deliverySummary ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-medium" style={{ color: "var(--foreground)" }}>
                      {deliverySummary.estimatedDeliveryText}
                    </span>
                    {deliverySummary.isFreeDelivery && (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        Free delivery
                      </span>
                    )}
                  </div>
                  {!deliverySummary.isFreeDelivery && deliverySummary.deliveryFee > 0 && (
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Delivery fee: ₹{Number(deliverySummary.deliveryFee).toFixed(2)}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Delivery slot selector */}
            {!loadingSlots && deliverySlots.length > 0 && (
              <div
                className="rounded-xl p-6 shadow-sm border"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <h2 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
                  Choose delivery slot
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deliverySlots.filter((s) => s.available).map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const slotDate = new Date(slot.date);
                    const dateLabel = slotDate.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    });
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(isSelected ? null : slot.id)}
                        className="checkout-slot-btn text-left rounded-xl p-4 border-2 transition-all duration-200 hover:shadow-md focus:outline-none active:scale-[0.99]"
                        style={{
                          background: isSelected ? "var(--secondary)" : "var(--background)",
                          borderColor: isSelected ? "var(--primary)" : "var(--border)",
                          boxShadow: isSelected ? "var(--shadow-soft)" : undefined,
                        }}
                      >
                        <div className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                          {dateLabel}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                          {slot.startTime} – {slot.endTime}
                        </div>
                        {isSelected && (
                          <span className="mt-2 inline-block text-xs font-semibold" style={{ color: "var(--primary)" }}>
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedSlotId && (
                  <button
                    type="button"
                    onClick={() => setSelectedSlotId(null)}
                    className="mt-3 text-sm font-medium underline"
                    style={{ color: "var(--muted)" }}
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}
            {!loadingSlots && deliverySlots.length === 0 && (
              <div
                className="rounded-xl p-4 border border-dashed"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <p className="text-sm">
                  {slotsError
                    ? "Could not load delivery slots. You can still place the order; we'll use the default delivery date."
                    : "No delivery slots available for the next 7 days. Default ETA applies."}
                </p>
                {slotsError && (
                  <button
                    type="button"
                    onClick={fetchSlots}
                    className="mt-2 text-sm font-medium underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            {/* Add address modal (checkout) */}
            {addAddressModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: "rgba(0,0,0,0.4)" }}
                onClick={() => !savingNewAddress && setAddAddressModalOpen(false)}
              >
                <div
                  className="rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
                    Add delivery address
                  </h3>
                  <AddressForm
                    onSubmit={handleAddAddressFromCheckout}
                    onCancel={() => !savingNewAddress && setAddAddressModalOpen(false)}
                    loading={savingNewAddress}
                    submitLabel="Add & use this address"
                  />
                </div>
              </div>
            )}

            {/* Section 2 — Contact Details */}
            <div
              className="rounded-xl p-6 shadow-sm border"
              style={{ background: "var(--background)", borderColor: "var(--border)" }}
            >
              <h2 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
                Contact Details
              </h2>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  Email <span className="text-[var(--muted)]">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 transition-all"
                  style={{ background: "var(--background)", borderColor: "var(--border)" }}
                  autoComplete="email"
                />
              </div>
            </div>
          </div>

          {/* Right — Order Summary */}
          <div className="lg:col-span-1">
            <div
              className="rounded-xl p-6 shadow-sm border sticky top-24"
              style={{ background: "var(--background)", borderColor: "var(--border)" }}
            >
              <h2 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
                Order Summary
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "var(--muted)" }}>
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <img src="/logo.png" alt="" className="w-8 h-8 opacity-50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm" style={{ color: "var(--foreground)" }}>{item.productName}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{item.sizeLabel} × {item.quantity}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--primary)" }}>₹{Number(item.subtotal || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between text-sm mb-1" style={{ color: "var(--foreground)" }}>
                  <span>Subtotal ({itemCount} items)</span>
                  <span>₹{Number(subtotal).toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm mb-1" style={{ color: "var(--success)" }}>
                    <span>Discount</span>
                    <span>-₹{Number(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm mb-1" style={{ color: "var(--foreground)" }}>
                  <span>
                    Delivery
                    {deliverySummary?.isFreeDelivery && (
                      <span className="ml-1 text-xs" style={{ color: "var(--primary)" }}>Free</span>
                    )}
                  </span>
                  <span>
                    {loadingSummary && !deliverySummary
                      ? "—"
                      : deliverySummary?.isFreeDelivery
                        ? "₹0.00"
                        : `₹${Number(deliveryFee).toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2" style={{ color: "var(--foreground)" }}>
                  <span>Total</span>
                  <span style={{ color: "var(--primary)" }}>₹{Number(total).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                  Payment method
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition" style={{ borderColor: paymentMethod === PAYMENT_METHOD_ONLINE ? "var(--primary)" : "var(--border)", background: paymentMethod === PAYMENT_METHOD_ONLINE ? "var(--secondary)" : "transparent" }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === PAYMENT_METHOD_ONLINE}
                      onChange={() => { setPaymentMethod(PAYMENT_METHOD_ONLINE); setPaymentError(null); }}
                      className="w-4 h-4"
                    />
                    <span style={{ color: "var(--foreground)" }}>Pay Online</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>UPI, Card, Netbanking, Wallets</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition" style={{ borderColor: paymentMethod === PAYMENT_METHOD_COD ? "var(--primary)" : "var(--border)", background: paymentMethod === PAYMENT_METHOD_COD ? "var(--secondary)" : "transparent" }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === PAYMENT_METHOD_COD}
                      onChange={() => { setPaymentMethod(PAYMENT_METHOD_COD); setPaymentError(null); }}
                      className="w-4 h-4"
                    />
                    <span style={{ color: "var(--foreground)" }}>Cash on Delivery</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Pay when you receive</span>
                  </label>
                </div>
              </div>

              {paymentError && (
                <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: "var(--destructive)", color: "white" }}>
                  {paymentError}
                </div>
              )}

              {/* Section 4 — Place Order CTA */}
              <button
                type="submit"
                disabled={submitting || loadingSummary || !!summaryError}
                className="w-full mt-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
                style={{
                  background: "var(--btn-primary-bg)",
                  color: "var(--btn-primary-fg)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {submitting ? (paymentMethod === PAYMENT_METHOD_COD ? "Placing order…" : "Opening payment…") : "Place Order"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
