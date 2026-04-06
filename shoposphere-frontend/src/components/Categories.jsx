import { Link } from "react-router-dom";

function getCategoryLinkClassName(isActive) {
  return [
    "relative isolate overflow-hidden bg-[#eef1f8]",
    "shadow-[0_18px_50px_rgba(44,51,61,0.12)]",
    "transition-transform duration-300 hover:scale-105",
    isActive ? "border-[#2c333d]/80" : "border-[#dce3f0]/45",
  ].join(" ");
}

export default function Categories({
  categories = [],
  selectedCategoryId = null,
  showHeader = false,
  title = "Shop by Category",
  className = "",
}) {
  const hasSelection = selectedCategoryId != null;

  return (
    <section className={className} aria-label="Categories showcase">
      {showHeader ? (
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl font-bold mb-4" style={{ color: "var(--foreground)" }}>
            {title}
          </h2>
        </div>
      ) : null}

      <div className="relative z-0 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 auto-rows-[170px] gap-1 sm:gap-2 md:hidden">
          {categories.slice(0, 3).map((category, idx) => {
            const collectionNumber = String(idx + 1).padStart(2, "0");
            const isActive = hasSelection && Number(selectedCategoryId) === Number(category.id);
            return (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className={[
                  getCategoryLinkClassName(isActive),
                  "rounded-t-[38px] rounded-b-sm border",
                  idx === 0 ? "col-span-2 row-span-2" : "",
                  idx === 1 ? "col-span-1 row-span-2" : "",
                  idx === 2 ? "col-span-1 row-span-2" : "",
                ].join(" ")}
              >
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#d9deeb]">
                    <img src="/logo.png" alt="shoposphere" className="h-11 w-auto object-contain opacity-55" />
                  </div>
                )}

                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/18 to-black/5" />

                <div className="absolute top-5 right-5 h-9 w-9 rounded-full bg-white/14 backdrop-blur-sm border border-white/30 text-white flex items-center justify-center">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </div>

                <div className="absolute inset-x-5 bottom-5 text-white">
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.35em] text-white/85 mb-1.5">
                    {collectionNumber} / Collection
                  </p>
                  <p className="font-extrabold tracking-tight leading-[0.9] uppercase text-3xl sm:text-4xl">
                    {category.name}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {categories.length > 3 ? (
          <div className="grid grid-cols-2 gap-1 md:hidden">
            {categories.slice(3).map((category) => {
              const isActive = hasSelection && Number(selectedCategoryId) === Number(category.id);
              return (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className={[
                    getCategoryLinkClassName(isActive),
                    "aspect-4/5 rounded-sm border",
                  ].join(" ")}
                >
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt={category.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#d9deeb]">
                      <img src="/logo.png" alt="shoposphere" className="h-10 w-auto object-contain opacity-55" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-black/0" />

                  <div className="absolute inset-x-3 bottom-3 text-white">
                    <p className="font-extrabold tracking-tight leading-none uppercase text-lg sm:text-xl">
                      {category.name}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="hidden md:grid md:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((category, idx) => {
            const collectionNumber = String(idx + 1).padStart(2, "0");
            const isActive = hasSelection && Number(selectedCategoryId) === Number(category.id);
            return (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className={[
                  getCategoryLinkClassName(isActive),
                  "aspect-3/4 rounded-sm border",
                ].join(" ")}
              >
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#d9deeb]">
                    <img src="/logo.png" alt="shoposphere" className="h-10 w-auto object-contain opacity-55" />
                  </div>
                )}

                <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-black/0" />

                <div className="absolute inset-x-3 bottom-3 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85 mb-1">
                    {collectionNumber} / Collection
                  </p>
                  <p className="font-extrabold tracking-tight leading-none uppercase text-xl sm:text-2xl">
                    {category.name}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
