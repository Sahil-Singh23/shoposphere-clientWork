import { useEffect, useState } from "react";
import { API } from "../api";
import { shuffleArray } from "../utils/shuffle";
import ProductCard from "../components/ProductCard";

export default function NewArrivals() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch(`${API}/products`)
      .then((res) => res.json())
      .then((data) => setProducts(shuffleArray((Array.isArray(data) ? data : []).filter((p) => p.isNew))));
  }, []);

  return (
    <div className="min-h-screen py-8">
      <div className="px-8 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-4">New Arrivals</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
