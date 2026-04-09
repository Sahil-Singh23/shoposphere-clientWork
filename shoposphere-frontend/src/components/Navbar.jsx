import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { useUserAuth } from "../context/UserAuthContext";
import { useWishlist } from "../context/WishlistContext";
import Typed from "typed.js";
import Fuse from "fuse.js";
import { API } from "../api";

export default function Navbar() {
  const { getCartCount } = useCart();
  const { wishlistProductIds } = useWishlist();
  const { isAuthenticated } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const typedElementRef = useRef(null);
  const typedInstanceRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Force light theme for now while keeping dark styles available for later.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    localStorage.setItem("shoposphere-theme", "light");
  }, []);

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/categories", label: "Categories" },
    { path: "/new", label: "New Arrivals" },
    { path: "/about", label: "About" },
    { path: "/contact", label: "Contact" },
  ];

  // Track viewport so we only mount ONE typed placeholder element at a time
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768); // md breakpoint
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Fetch all products for fuzzy search
  useEffect(() => {
    fetch(`${API}/products`)
      .then(res => res.json())
      .then(data => {
        setAllProducts(data);
      })
      .catch(error => {
        console.error("Error fetching products for search:", error);
      });
  }, []);

  // Fuzzy search suggestions
  useEffect(() => {
    if (searchQuery.trim().length > 0 && allProducts.length > 0) {
      const fuse = new Fuse(allProducts, {
        keys: ['name', 'description', 'keywords'],
        threshold: 0.4, // 0 = perfect match, 1 = match anything
        includeScore: true,
        minMatchCharLength: 2,
      });

      const results = fuse.search(searchQuery);
      const suggestions = results.slice(0, 5).map(result => result.item);
      
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setSearchSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      }, 0);
    } else {
      setTimeout(() => {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }, 0);
    }
  }, [searchQuery, allProducts]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        ((searchInputRef.current && !searchInputRef.current.contains(event.target)) ||
          (mobileSearchInputRef.current && !mobileSearchInputRef.current.contains(event.target)))
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Mobile search overlay: focus + escape + scroll lock
  useEffect(() => {
    if (!isMobileSearchOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => {
      mobileSearchInputRef.current?.focus?.();
    }, 50);

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMobileSearchOpen(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileSearchOpen]);

  // Initialize Typed.js for search bar
  useEffect(() => {
    // Destroy + recreate so Typed always attaches to the currently mounted span (mobile vs desktop)
    if (typedInstanceRef.current) {
      typedInstanceRef.current.destroy();
      typedInstanceRef.current = null;
    }

    if (typedElementRef.current) {
      typedInstanceRef.current = new Typed(typedElementRef.current, {
        strings: [" Trendy outfits, delivered to you", " New-season styles, every day"],
        typeSpeed: 50,
        backSpeed: 30,
        backDelay: 2000,
        loop: true,
        showCursor: false,
      });
    }

    return () => {
      if (typedInstanceRef.current) {
        typedInstanceRef.current.destroy();
        typedInstanceRef.current = null;
      }
    };
  }, [isMobile]);

  // Control typing based on searchQuery
  useEffect(() => {
    if (typedInstanceRef.current) {
      if (searchQuery) {
        typedInstanceRef.current.stop();
      } else {
        typedInstanceRef.current.start();
      }
    }
  }, [searchQuery]);

  return (
    <nav
      className="sticky top-0 z-50 bg-(--background)/95 backdrop-blur-sm border-b transition-all"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-20">
          <div className="flex items-center gap-3 lg:gap-3 min-w-0 flex-1">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <img
                src="/logo.png"
                alt="shoposphere"
                className="h-9 md:h-11 w-auto shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              {navItems.map((item) => (
                <div key={item.path} className="relative">
                  <Link
                    to={item.path}
                    className={`px-3 py-2 lg:px-4 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out ${
                      isActive(item.path) ? "ring-1 ring-(--border)" : ""
                    }`}
                    style={{
                      color: isActive(item.path) ? "var(--foreground)" : "var(--foreground-muted)",
                      backgroundColor: isActive(item.path) ? "var(--secondary)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.backgroundColor = "var(--secondary)";
                        e.currentTarget.style.color = "var(--foreground)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "var(--foreground-muted)";
                      }
                    }}
                  >
                    {item.label}
                    {item.badge && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}>
                        {item.badge}
                      </span>
                    )}
                  </Link>

                </div>
              ))}
            </div>

            {/* Search (desktop) */}
            

          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-2.5 ml-3 lg:ml-4 shrink-0">

            {/* User auth: Login/Signup or user menu */}
            <div className="relative hidden md:block">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Stop typing when user starts typing
                    if (typedInstanceRef.current && e.target.value) {
                      typedInstanceRef.current.stop();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      setShowSuggestions(false);
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--border)';
                    e.target.style.backgroundColor = 'var(--background)';
                    e.target.style.color = 'var(--foreground)';
                    // Pause typing when focused
                    if (typedInstanceRef.current) {
                      typedInstanceRef.current.stop();
                    }
                    if (searchSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={(e) => {
                    // Delay to allow click on suggestions
                    setTimeout(() => {
                      if (!searchQuery) {
                        e.target.style.borderColor = 'var(--border)';
                        e.target.style.backgroundColor = 'var(--input)';
                        e.target.style.color = 'transparent';
                        // Resume typing when blurred and no query
                        if (typedInstanceRef.current) {
                          typedInstanceRef.current.start();
                        }
                      }
                      setShowSuggestions(false);
                    }, 200);
                  }}
                  className="rounded-full px-5 py-2.5 pr-10 w-60 text-sm transition-all duration-300 relative z-10"
                  style={{
                    backgroundColor: searchQuery ? 'var(--background)' : 'var(--input)',
                    border: '1px solid var(--border)',
                    color: searchQuery ? 'var(--foreground)' : 'transparent'
                  }}
                />
                {!searchQuery && !isMobile && (
                  <span
                    ref={typedElementRef}
                    className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-sm z-20"
                    style={{ color: 'var(--foreground-muted)' }}
                  ></span>
                )}
                <button
                  onClick={() => {
                    if (searchQuery.trim()) {
                      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      setShowSuggestions(false);
                    }
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer z-30"
                >
                  <svg
                    className="w-4 h-4"
                    style={{ color: 'var(--foreground-muted)' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 mt-2 w-60 rounded-lg shadow-xl border z-50 max-h-80 overflow-y-auto"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                  >
                    <div className="p-2">
                      <div className="text-xs font-semibold px-3 py-2" style={{ color: 'var(--foreground-muted)' }}>
                        Suggestions
                      </div>
                      {searchSuggestions.map((product) => {
                        const images = product.images ? (Array.isArray(product.images) ? product.images : JSON.parse(product.images)) : [];
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShowSuggestions(false);
                              setSearchQuery("");
                              navigate(`/product/${product.id}`);
                            }}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer group"
                            style={{ backgroundColor: 'transparent' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--secondary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {images.length > 0 ? (
                              <img
                                src={images[0]}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded-lg"
                              />
                            ) : (
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--secondary)' }}>
                              <img src="/logo.png" alt="shoposphere" className="h-6 w-auto max-w-9 object-contain opacity-50" />
                            </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
                                {product.name}
                              </div>
                              {((product.categories && product.categories.length > 0) || product.category) && (
                                <div className="text-xs truncate" style={{ color: 'var(--foreground-muted)' }}>
                                  {product.categories && product.categories.length > 0
                                    ? product.categories.map(c => c.name || c.category?.name).join(", ")
                                    : product.category?.name}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!searchQuery.trim()) return;
                          setShowSuggestions(false);
                          navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                        }}
                        className="block px-3 py-2 rounded-lg text-sm font-semibold text-center transition-colors"
                        style={{ color: 'var(--foreground)', backgroundColor: 'var(--secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--border)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--secondary)';
                        }}
                      >
                        View all results for "{searchQuery}"
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile search icon (visible < md) */}
            <button
              type="button"
              className="md:hidden p-2 rounded-full transition-all duration-300 active:scale-95"
              style={{ backgroundColor: "var(--secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--background)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
              aria-label="Open search"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsMobileSearchOpen(true);
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--foreground)" }} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <Link
              to={isAuthenticated ? "/profile" : "/login"}
              className="p-2 rounded-full transition-all duration-300 active:scale-95"
              style={{ backgroundColor: 'var(--secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
              aria-label={isAuthenticated ? "Go to profile" : "Log in"}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--foreground)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>

            {/* Cart */}
            <Link to="/profile/wishlist" className="relative group hidden md:inline-flex">
              <button
                className="p-2.5 rounded-full hover:scale-110 transition-all duration-300 active:scale-95"
                style={{ backgroundColor: "var(--secondary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--background)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--secondary)";
                }}
              >
                <svg className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--foreground)" }}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {wishlistProductIds.length > 0 && (
                  <span className="absolute top-0 right-0 min-w-[1.1rem] h-[1.1rem] px-1 text-[10px] rounded-full flex items-center justify-center font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {wishlistProductIds.length > 99 ? "99+" : wishlistProductIds.length}
                  </span>
                )}
              </button>
            </Link>

            <Link to="/cart" className="relative group hidden md:inline-flex">
              <button 
                className="p-2.5 rounded-full hover:scale-110 transition-all duration-300 active:scale-95"
                style={{ backgroundColor: 'var(--secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
              >
                <svg className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--foreground)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {getCartCount() > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 text-xs rounded-full flex items-center justify-center font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {getCartCount()}
                  </span>
                )}
              </button>
            </Link>

            {/* Mobile Menu Button (visible < md) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg transition-all duration-300 active:scale-95"
              style={{ color: 'var(--foreground-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile search overlay (preferred UX) */}
        <div
          className={`md:hidden fixed inset-0 z-[60] transition-opacity duration-200 ${isMobileSearchOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          aria-hidden={!isMobileSearchOpen}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close search"
            onClick={() => {
              setIsMobileSearchOpen(false);
              setShowSuggestions(false);
            }}
          />

          <div
            className={`absolute left-0 right-0 top-0 border-b transition-transform duration-200 ${isMobileSearchOpen ? "translate-y-0" : "-translate-y-2"}`}
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 rounded-full active:scale-95"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  aria-label="Close"
                  onClick={() => {
                    setIsMobileSearchOpen(false);
                    setShowSuggestions(false);
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="relative flex-1">
                  <input
                    ref={mobileSearchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchQuery.trim()) {
                        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                        setShowSuggestions(false);
                        setIsMobileSearchOpen(false);
                      } else if (e.key === "Escape") {
                        setIsMobileSearchOpen(false);
                        setShowSuggestions(false);
                      }
                    }}
                    placeholder="Search products"
                    className="w-full rounded-full pl-11 pr-11 py-3 text-sm border transition-all duration-200"
                    style={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    autoComplete="off"
                  />

                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {searchQuery ? (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full transition-all active:scale-95"
                      style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchQuery("");
                        setShowSuggestions(false);
                        setTimeout(() => mobileSearchInputRef.current?.focus?.(), 0);
                      }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}

                  {showSuggestions && searchSuggestions.length > 0 && isMobileSearchOpen ? (
                    <div
                      ref={suggestionsRef}
                      className="absolute left-0 right-0 mt-2 rounded-xl shadow-xl border z-50 max-h-[60vh] overflow-y-auto"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                    >
                      <div className="p-2">
                        <div className="text-xs font-semibold px-3 py-2" style={{ color: "var(--foreground-muted)" }}>
                          Suggestions
                        </div>
                        {searchSuggestions.map((product) => {
                          let images = [];
                          try {
                            images = product.images
                              ? Array.isArray(product.images)
                                ? product.images
                                : JSON.parse(product.images)
                              : [];
                          } catch {
                            images = [];
                          }
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setShowSuggestions(false);
                                setIsMobileSearchOpen(false);
                                setSearchQuery("");
                                navigate(`/product/${product.id}`);
                              }}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer group"
                              style={{ backgroundColor: "transparent" }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                            >
                              {images.length > 0 ? (
                                <img src={images[0]} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                                  <img src="/logo.png" alt="shoposphere" className="h-6 w-auto max-w-9 object-contain opacity-50" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
                                  {product.name}
                                </div>
                                {product.category?.name ? (
                                  <div className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>
                                    {product.category.name}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!searchQuery.trim()) return;
                            setShowSuggestions(false);
                            setIsMobileSearchOpen(false);
                            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                          }}
                          className="block w-full px-3 py-2 rounded-lg text-sm font-semibold text-center transition-colors"
                          style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--border)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
                        >
                          View all results for "{searchQuery}"
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu — slide-down, large tap targets (visible < md) */}
        <div
          className="md:hidden overflow-y-auto overflow-x-hidden transition-[max-height] duration-300 ease-in-out"
          style={{ maxHeight: isMobileMenuOpen ? "85vh" : "0" }}
        >
          <div
            className="flex flex-col border-t border-(--border)"
            style={{ backgroundColor: "var(--background)" }}
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-4 py-3.5 text-base font-medium transition-all duration-300 active:scale-[0.98] border-b border-l-4 border-(--border) last:border-b-0`}
                style={{
                  color: isActive(item.path) ? "var(--foreground)" : "var(--foreground-muted)",
                  backgroundColor: isActive(item.path) ? "var(--secondary)" : "transparent",
                  borderLeftColor: isActive(item.path) ? "var(--primary)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = "var(--secondary)";
                    e.currentTarget.style.color = "var(--foreground)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--foreground-muted)";
                  }
                }}
              >
                {item.label}
                {item.badge && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
