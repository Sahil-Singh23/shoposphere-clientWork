export default function About() {
  const reels = [
    {
      tag: "Process",
      title: "The Sourcing Trip",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBwjegQkRIw194MMJd_-9B7z9eflpoXmhCS98hK79FGyNalhZ--tWhKb8YlEKbuKIqCCBpDyoz2WczDFCEvJS148WAfF5jdelOiZEXyNKcsLttwSZpPBhb9e6lcs2jJv1RO2jYc0rc-Ru5pc74n4wfYrfKgBwtoTkyf3P2ZsuXNonvl9QsQRjWZDw0X_DE0fSP3OfWmbiYd5sPJzhG-5JNcHLaBSS18Doeinhr-h2n-_mwByjiIW20rOmk39IjrbwNl2FXwzJdvFzA",
      alt: "Cinematic shot of a minimalist design studio with clean white walls and organized craft tools on a wooden desk.",
    },
    {
      tag: "Community",
      title: "The Loft Opening",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWsIMU_cXzCghhSWrGhB4bLQ9ibHLyrJ8gaGk6Tp7sKQThYMrhA18OkpGqF5BR2xcJpNz-f1iHg7W3vb1QmAXfxCMkoZCnYbpJbDC5KfasQEIQOBX2pdT42JOxQkei24rtuEl43S5wPPK3vU_CzGfJ84i51kjAmDq3M8tExLbBt8AP5no2AJzG2l77c8y0HY6QPBnCf3_Pwrj7PhYSdHf8o4RJl6l62GFDinB4c9-R9M2lGqmsCPolJNOKLYcC6S89yaH4e_icuEw",
      alt: "Candid moment of a diverse team collaborating around a large table with coffee and architectural blueprints.",
    },
    {
      tag: "Philosophy",
      title: "The Mono Mindset",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDFvUUafFGCd-7C2P934aKDGidPonNo0PRYA_KfTq3lszVP1DGWqJX-IsKRv_fQBWj-8O-hxTP56yw8FD3h6MiljEPrvjFmU0SHZAr_C8jl_EtkdLBDxDk3ZUyC1LLvGOlWrYnTHoRheD-wadDy4Ed88SHBdN_HD_jIX6Q8vHlqUhLgUpLmVx1Dozzi2FGrk-7RIMRkR0CAfS9R-TvtbRDePRDstYGdqCUJGvrPt4ARCwXis3EZ4X-go9_cW6yMr0tGD8p2lO-p0gw",
      alt: "Detailed close-up of high-quality linen fabric being measured on a sleek black workstation.",
    },
    {
      tag: "Curation",
      title: "Summer Selection",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBvv5ZnX5Qap-C3-qhFE-MllRKzBd3aU5X6_jy1B8TCIS-H0apTFcdDPRxowzL4UQi8VrEYylawTxGCuZ0Bz6XRTsdCB2xXRkTP55IeVUMLxUFzTCsxdGzHZ3m7zIGD9xnA42O3wdxirOXo-L9HMzny1BciDFRetFZNpNoNRACzPXSYqld0X2BZiawwBwUKDH-xsYZ1PcyolXlWdGn3HdgOO9XQE3gOSpp6-GrCF3TZYEnd1TnCzzrMLKwPt5GAAB2LqYuCqbQxM-Q",
      alt: "Artistic soft focus shot of minimalist home decor objects on a light grey textured background.",
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--page-products-bg)" }}>
      <main className="pt-10 sm:pt-14 pb-24">
        {/* Hero Header */}
        <section className="max-w-screen-2xl mx-auto px-6 md:px-24 mb-14 sm:mb-20">
          <span className="text-xs uppercase tracking-[0.2em] text-muted mb-4 block">The Narrative</span>
          <h1 className="font-display font-semibold text-4xl sm:text-5xl md:text-7xl tracking-tight leading-none text-design-foreground max-w-4xl">
            The Face of Shoposphere
          </h1>
        </section>

        {/* Founder Profile */}
        <section className="max-w-screen-2xl mx-auto px-6 md:px-24 mb-20 sm:mb-32 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-7">
            <div className="relative overflow-hidden rounded-2xl shadow-[0_20px_40px_rgba(26,28,28,0.10)] aspect-[4/5] bg-card">
              <img
                alt="Yash Jhanwar Founder Portrait"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfzA_qLk1n47deNkKIBV1aO-jrZH6r2EO2rnTfg9n2j_xmsYQjAOe6O_2kI00-mhpn8LXcJjX8S1OPONLysTds_xEveX4uaFPhTgzNAJFKAqnXRb79NzGAz03NaVmARJe_mZX93hIM1Ji7c1pyWb3vKVNiJx05gIubue9UjhpPC2S-BLvUr2OsDyn6uBdKuCCaeBScUcBSxf24hbDv-bSVyJkHNh0_FVkt69ETL-7JC4muVQYkFsAlkCII8_BieKnXJIdYa2Unao0"
              />
            </div>
          </div>

          <div className="md:col-span-5 pb-2 sm:pb-6 md:pl-10">
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-design-foreground">
                  Yash Jhanwar
                </h2>
                <p className="text-base sm:text-lg text-muted">Founder &amp; Creative Director</p>
              </div>

              <p className="text-base sm:text-lg leading-relaxed text-muted">
                “Shoposphere was born out of a desire to strip away the noise of modern commerce. We believe that
                what you surround yourself with should reflect a quiet confidence and an uncompromising eye for
                detail.”
              </p>

              <div className="flex gap-4">
                <button
                  type="button"
                  className="rounded-full px-7 py-3 text-sm font-semibold tracking-wide active:scale-95"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  FOLLOW THE JOURNEY
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Built on Principles */}
        <section className="max-w-screen-2xl mx-auto px-6 md:px-24 mb-20 sm:mb-32">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-12">
            <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-design-foreground">
              Built on Principles
            </h3>
            <p className="text-muted max-w-xs text-sm">Curated with precision, delivered with intent.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 sm:p-10 bg-card rounded-2xl shadow-[0_20px_40px_rgba(26,28,28,0.08)] transition-transform hover:scale-[1.02]">
              <div className="h-12 w-12 rounded-2xl grid place-items-center mb-6" style={{ backgroundColor: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" style={{ color: "var(--foreground)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l1.7 5.3H19l-4.3 3.1L16.4 17 12 13.9 7.6 17l1.7-5.6L5 8.3h5.3L12 3z" />
                </svg>
              </div>
              <h4 className="font-display text-lg font-semibold mb-3">Curated Quality</h4>
              <p className="text-muted text-sm leading-relaxed">
                We source products that pass a rigorous vetting process, ensuring that every piece in our gallery is an
                investment in longevity.
              </p>
            </div>

            <div
              className="p-8 sm:p-10 rounded-2xl shadow-[0_20px_40px_rgba(26,28,28,0.10)] transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <div className="h-12 w-12 rounded-2xl grid place-items-center mb-6" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h18M7 21V9l5-5 5 5v12" />
                </svg>
              </div>
              <h4 className="font-display text-lg font-semibold mb-3">Minimalist Ethos</h4>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                Form follows function. Our design language is rooted in the belief that simplicity is the ultimate form of
                sophistication.
              </p>
            </div>

            <div className="p-8 sm:p-10 bg-card rounded-2xl shadow-[0_20px_40px_rgba(26,28,28,0.08)] transition-transform hover:scale-[1.02]">
              <div className="h-12 w-12 rounded-2xl grid place-items-center mb-6" style={{ backgroundColor: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" style={{ color: "var(--foreground)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-4-4h-1M7 20H2v-2a4 4 0 014-4h1m10-3a4 4 0 10-8 0 4 4 0 008 0zm6 0a3 3 0 10-6 0 3 3 0 006 0zM7 10a3 3 0 10-6 0 3 3 0 006 0z" />
                </svg>
              </div>
              <h4 className="font-display text-lg font-semibold mb-3">Community Driven</h4>
              <p className="text-muted text-sm leading-relaxed">
                Shoposphere isn’t just a store; it’s a collective of like-minded individuals who value the intersection of
                art and utility.
              </p>
            </div>
          </div>
        </section>

        {/* Our Story in Motion */}
        <section className="mb-20 sm:mb-32">
          <div className="max-w-screen-2xl mx-auto px-6 md:px-24 mb-8 sm:mb-12">
            <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-2 text-design-foreground">
              Our Story in Motion
            </h3>
            <p className="text-muted">Behind the scenes at the Loft.</p>
          </div>

          <div className="flex overflow-x-auto scrollbar-hide gap-5 sm:gap-6 px-6 md:px-24 pb-4 snap-x snap-mandatory">
            {reels.map((r) => (
              <div
                key={r.title}
                className="flex-none w-64 sm:w-72 aspect-[9/16] rounded-2xl overflow-hidden relative snap-start group cursor-pointer"
                style={{ backgroundColor: "var(--muted)" }}
                role="button"
                tabIndex={0}
                onKeyDown={() => {}}
              >
                <img
                  alt={r.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  src={r.img}
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-5 sm:p-6">
                  <div className="text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 opacity-80">{r.tag}</p>
                    <p className="font-semibold">{r.title}</p>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-white/20 backdrop-blur-md rounded-full p-4">
                    <svg viewBox="0 0 24 24" className="h-10 w-10 text-white fill-current">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="max-w-screen-2xl mx-auto px-6 md:px-24 pb-4">
          <div className="rounded-2xl p-8 sm:p-12 md:p-20 text-center" style={{ backgroundColor: "var(--muted)" }}>
            <h3 className="font-display text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight mb-7 text-design-foreground">
              Join the curated movement.
            </h3>
            <form
              className="max-w-md mx-auto flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                className="flex-1 rounded-full px-6 py-4 border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--card-white)",
                  borderColor: "transparent",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                }}
                placeholder="Email Address"
                type="email"
              />
              <button
                type="submit"
                className="rounded-full px-8 py-4 font-semibold active:scale-95"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                JOIN
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
