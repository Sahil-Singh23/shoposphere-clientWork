import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { useUserAuth } from "../context/UserAuthContext";
import Typed from "typed.js";
import Fuse from "fuse.js";
import { API } from "../api";

export default function Navbar() {
  const { getCartCount } = useCart();
  const { user, isAuthenticated, logout } = useUserAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const mobileUserMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(e.target)) {
        setMobileUserMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const typedElementRef = useRef(null);
  const typedInstanceRef = useRef(null);
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Force light theme for now while keeping dark styles available for later.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    localStorage.setItem("skfruits-theme", "light");
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
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur-sm border-b transition-all"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-3 lg:gap-3 min-w-0 flex-1">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <div
                className="w-12 h-12 md:w-13 md:h-13 rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-107"
                style={{ backgroundColor: "var(--secondary)" }}
              >
                <img src="/logo.png" alt="SK Fruits" className="w-full h-full object-cover" />
              </div>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              {navItems.map((item) => (
                <div key={item.path} className="relative">
                  <Link
                    to={item.path}
                    className={`px-3 py-2 lg:px-4 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out ${
                      isActive(item.path) ? "ring-1 ring-[var(--border)]" : ""
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
          <div className="flex items-center gap-3 ml-3 lg:ml-4 shrink-0">

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
                          <Link
                            key={product.id}
                            to={`/product/${product.id}`}
                            onClick={() => {
                              setShowSuggestions(false);
                              setSearchQuery("");
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
                              <img src="/logo.png" alt="SK Fruits" className="w-10 h-10 object-contain opacity-50" />
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
                          </Link>
                        );
                      })}
                      <Link
                        to={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                        onClick={() => setShowSuggestions(false)}
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
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2" ref={userMenuRef}>
              {isAuthenticated && user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="px-3 py-2 rounded-full text-sm font-medium transition-all"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  >
                    {user.name || user.email}
                  </button>
                  {userMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg border min-w-[160px] z-50"
                      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
                    >
                      {user.role === "driver" && (
                        <Link
                          to="/driver"
                          onClick={() => setUserMenuOpen(false)}
                          className="block w-full text-left px-4 py-2 text-sm hover:opacity-90 font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          Driver dashboard
                        </Link>
                      )}
                      <Link
                        to="/profile/addresses"
                        onClick={() => setUserMenuOpen(false)}
                        className="block w-full text-left px-4 py-2 text-sm hover:opacity-90"
                        style={{ color: "var(--foreground)" }}
                      >
                        Addresses
                      </Link>
                      <Link
                        to="/profile/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="block w-full text-left px-4 py-2 text-sm hover:opacity-90"
                        style={{ color: "var(--foreground)" }}
                      >
                        My Orders
                      </Link>
                      <Link
                        to="/profile/wishlist"
                        onClick={() => setUserMenuOpen(false)}
                        className="block w-full text-left px-4 py-2 text-sm hover:opacity-90"
                        style={{ color: "var(--foreground)" }}
                      >
                        Wishlist
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:opacity-90"
                        style={{ color: "var(--foreground)" }}
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-3 py-2 rounded-full text-sm font-medium transition-all"
                    style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="px-3 py-2 rounded-full text-sm font-semibold transition-all btn-primary-brand"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>

            {/* Cart */}
            <Link to="/cart" className="relative group">
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
              <span className="absolute -top-9 right-0 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0" style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>
                Your Cart
              </span>
            </Link>

            {/* Mobile: Login/Signup in header when not authenticated */}
            {!isAuthenticated && (
              <div className="md:hidden flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all btn-primary-brand"
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile User Menu - visible only on mobile when authenticated */}
            {isAuthenticated && user && (
              <div className="md:hidden relative" ref={mobileUserMenuRef}>
                <button
                  type="button"
                  onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
                  className="p-2.5 rounded-full transition-all duration-300 active:scale-95"
                  style={{ backgroundColor: 'var(--secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--foreground)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
                {mobileUserMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 py-2 rounded-lg shadow-lg border min-w-[180px] z-50"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
                  >
                    <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {user.name || user.email}
                      </div>
                      <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {user.email}
                      </div>
                    </div>
                    {user.role === "driver" && (
                      <Link
                        to="/driver"
                        onClick={() => setMobileUserMenuOpen(false)}
                        className="block w-full text-left px-4 py-2 text-sm hover:opacity-90 font-medium"
                        style={{ color: "var(--primary)" }}
                      >
                        Driver dashboard
                      </Link>
                    )}
                    <Link
                      to="/profile/addresses"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="block w-full text-left px-4 py-2 text-sm hover:opacity-90"
                      style={{ color: "var(--foreground)" }}
                    >
                      Addresses
                    </Link>
                    <Link
                      to="/profile/orders"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="block w-full text-left px-4 py-2 text-sm hover:opacity-90"
                      style={{ color: "var(--foreground)" }}
                    >
                      My Orders
                    </Link>
                    <Link
                      to="/profile/wishlist"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="block w-full text-left px-4 py-2 text-sm hover:opacity-90"
                      style={{ color: "var(--foreground)" }}
                    >
                      Wishlist
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMobileUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:opacity-90 border-t"
                      style={{ color: "var(--foreground)", borderColor: "var(--border)" }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Button (visible < md) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg transition-all duration-300 active:scale-95"
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

        {/* Mobile Search (Nykaa-style) */}
        <div className="md:hidden pb-3">
          <div className="relative">
            <button
              type="button"
              aria-label="Search"
              onClick={() => {
                if (searchQuery.trim()) {
                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  setShowSuggestions(false);
                }
              }}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 z-30"
            >
              <svg
                className="w-4 h-4"
                style={{ color: "var(--foreground-muted)" }}
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

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (typedInstanceRef.current && e.target.value) {
                  typedInstanceRef.current.stop();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  setShowSuggestions(false);
                } else if (e.key === "Escape") {
                  setShowSuggestions(false);
                }
              }}
              placeholder=""
              className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm border transition-all duration-300"
                style={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  color: searchQuery ? "var(--foreground)" : "transparent",
                }}
              onFocus={() => {
                // reveal text + pause typing
                if (searchInputRef.current) {
                  searchInputRef.current.style.color = "var(--foreground)";
                }
                if (typedInstanceRef.current) typedInstanceRef.current.stop();
                if (searchSuggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowSuggestions(false);
                  if (!searchQuery) {
                    if (typedInstanceRef.current) typedInstanceRef.current.start();
                  }
                }, 200);
              }}
            />

            {!searchQuery && isMobile && (
              <span
                ref={typedElementRef}
                className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-sm z-20"
                style={{ color: "var(--foreground-muted)" }}
              ></span>
            )}

            {/* Mobile Suggestions */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 mt-2 w-full rounded-lg shadow-xl border z-50 max-h-80 overflow-y-auto"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              >
                <div className="p-2">
                  <div
                    className="text-xs font-semibold px-3 py-2"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Suggestions
                  </div>
                  {searchSuggestions.map((product) => {
                    const images = product.images
                      ? Array.isArray(product.images)
                        ? product.images
                        : JSON.parse(product.images)
                      : [];
                    return (
                      <Link
                        key={product.id}
                        to={`/product/${product.id}`}
                        onClick={() => {
                          setShowSuggestions(false);
                          setSearchQuery("");
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                        style={{ backgroundColor: "transparent" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--secondary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        {images.length > 0 ? (
                          <img
                            src={images[0]}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                            style={{ backgroundColor: "var(--secondary)" }}
                          >
                            <img src="/logo.png" alt="SK Fruits" className="w-10 h-10 object-contain opacity-50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-semibold text-sm truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {product.name}
                          </div>
                          {product.category && (
                            <div
                              className="text-xs truncate"
                              style={{ color: "var(--foreground-muted)" }}
                            >
                              {product.category.name}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                  <Link
                    to={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                    onClick={() => setShowSuggestions(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-semibold text-center transition-colors"
                    style={{
                      color: "var(--foreground)",
                      backgroundColor: "var(--secondary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--border)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--secondary)";
                    }}
                  >
                    View all results for "{searchQuery}"
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu — slide-down, large tap targets (visible < md) */}
        <div
          className="md:hidden overflow-y-auto overflow-x-hidden transition-[max-height] duration-300 ease-in-out"
          style={{ maxHeight: isMobileMenuOpen ? "85vh" : "0" }}
        >
          <div
            className="flex flex-col border-t border-[var(--border)]"
            style={{ backgroundColor: "var(--background)" }}
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-4 py-3.5 text-base font-medium transition-all duration-300 active:scale-[0.98] border-b border-l-4 border-[var(--border)] last:border-b-0`}
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
            <div className="flex flex-col gap-2 px-4 py-3 border-t border-[var(--border)]">
              {isAuthenticated && user ? (
                <>
                  {user.role === "driver" && (
                    <Link
                      to="/driver"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="py-2.5 rounded-lg text-sm font-semibold text-center"
                      style={{ color: "var(--primary)", backgroundColor: "var(--secondary)" }}
                    >
                      Driver dashboard
                    </Link>
                  )}
                  <Link
                    to="/profile/addresses"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="py-2.5 rounded-lg text-sm font-semibold text-center"
                    style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                  >
                    Addresses
                  </Link>
                  <Link
                    to="/profile/orders"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="py-2.5 rounded-lg text-sm font-semibold text-center"
                    style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                  >
                    My Orders
                  </Link>
                  <Link
                    to="/profile/wishlist"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="py-2.5 rounded-lg text-sm font-semibold text-center"
                    style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                  >
                    Wishlist
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="py-2.5 rounded-lg text-sm font-semibold"
                    style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-center"
                    style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-center btn-primary-brand"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
