import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API } from "../api";
import { shuffleArray } from "../utils/shuffle";
import ProductCard from "../components/ProductCard";

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "";
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Fetch categories and all products for suggestions
  useEffect(() => {
    Promise.all([
      fetch(`${API}/categories`).then(res => res.json()),
      fetch(`${API}/products`).then(res => res.json())
    ])
      .then(([categoriesData, productsData]) => {
        setCategories(categoriesData);
        setAllProducts(productsData);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
      });
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      const params = new URLSearchParams();
      if (query) params.append("search", query);
      if (categoryFilter) params.append("category", categoryFilter);

      const url = `${API}/products?${params.toString()}`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        const safeData = shuffleArray(Array.isArray(data) ? data : []);
        setProducts(safeData);
        
          // If no results and we have a query, fall back to all products in selected category.
        if (safeData.length === 0 && query) {
          // Prefer fetching from API so it's always accurate.
          const fallbackParams = new URLSearchParams();
          if (categoryFilter) fallbackParams.append("category", categoryFilter);
          const fallbackUrl = `${API}/products?${fallbackParams.toString()}`;

          let fallbackProducts = [];
          if (categoryFilter) {
            const fallbackRes = await fetch(fallbackUrl);
            const fallbackJson = await fallbackRes.json();
            fallbackProducts = Array.isArray(fallbackJson) ? fallbackJson : [];
          } else {
            fallbackProducts = Array.isArray(allProducts) ? allProducts : [];
          }

          setSuggestedProducts(shuffleArray(fallbackProducts));
          setShowSuggestions(fallbackProducts.length > 0);
        } else {
          setSuggestedProducts([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("Error searching products:", error);
      }
    };

    performSearch();
  }, [query, categoryFilter, allProducts]);

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    const params = new URLSearchParams(searchParams);
    if (newCategory) {
      params.set("category", newCategory);
    } else {
      params.delete("category");
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen bg-white py-16">
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'oklch(20% .02 340)' }}>
            Search Results
          </h2>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold" style={{ color: 'oklch(40% .02 340)' }}>
                Category:
              </label>
              <select
                value={categoryFilter}
                onChange={handleCategoryChange}
                className="px-4 py-2 rounded-lg border-2 text-sm transition-all duration-300 focus:outline-none"
                style={{
                  borderColor: 'oklch(92% .04 340)',
                  backgroundColor: 'white',
                  color: 'oklch(20% .02 340)'
                }}
                onFocus={(e) => e.target.style.borderColor = 'oklch(88% .06 340)'}
                onBlur={(e) => e.target.style.borderColor = 'oklch(92% .04 340)'}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {categoryFilter && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300"
                style={{
                  backgroundColor: 'oklch(92% .04 340)',
                  color: 'oklch(20% .02 340)'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'oklch(88% .06 340)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'oklch(92% .04 340)'}
              >
                Clear Filters
              </button>
            )}
          </div>

          {(query || categoryFilter) && (
            <p className="text-lg mb-4" style={{ color: 'oklch(60% .02 340)' }}>
              {products.length > 0 
                ? `Found ${products.length} product${products.length !== 1 ? 's' : ''}${query ? ` for "${query}"` : ''}${categoryFilter ? ` in ${categories.find(c => c.slug === categoryFilter)?.name || categoryFilter}` : ''}`
                : `No products found${query ? ` for "${query}"` : ''}${categoryFilter ? ` in ${categories.find(c => c.slug === categoryFilter)?.name || categoryFilter}` : ''}`
              }
            </p>
          )}
        </div>

        {!query && !categoryFilter ? (
          <div className="text-center py-16">
            <div className="inline-block p-6 rounded-full mb-4" style={{ backgroundColor: 'oklch(92% .04 340)' }}>
              <span className="text-2xl">🔍</span>
            </div>
            <p className="font-medium" style={{ color: 'oklch(60% .02 340)' }}>
              Enter a search term or select filters to find products
            </p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : showSuggestions && suggestedProducts.length > 0 ? (
          <div>
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'oklch(92% .04 340)' }}>
              <p className="font-semibold mb-2" style={{ color: 'oklch(20% .02 340)' }}>
                No exact matches found for "{query}"
              </p>
              <p className="text-sm" style={{ color: 'oklch(60% .02 340)' }}>
                Showing {categoryFilter ? "all products in this category" : "all products"}:
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {suggestedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="font-medium mb-2" style={{ color: 'oklch(60% .02 340)' }}>
              No products found
            </p>
            <p className="text-sm" style={{ color: 'oklch(60% .02 340)' }}>
              Try searching with different keywords or adjust your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
