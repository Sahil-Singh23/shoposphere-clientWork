import { memo, useEffect, useRef, useState } from "react";
import { API } from "../api";

function getLowestAndHighestPrice(product) {
  const sizes = product?.sizes || [];
  if (!Array.isArray(sizes) || sizes.length === 0) return { low: null, high: null };
  const prices = sizes.map((s) => Number(s.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return { low: null, high: null };
  return { low: Math.min(...prices), high: Math.max(...prices) };
}

function formatINR(n) {
  if (!Number.isFinite(n)) return "";
  return `₹${Math.round(n)}`;
}

// Detect video URL type and extract embed info
function getVideoEmbedInfo(url) {
  if (!url) return { type: "none", url: null };
  
  const trimmed = url.trim();
  
  // Instagram URL patterns
  const instagramReelMatch = trimmed.match(/instagram\.com\/reel\/([A-Za-z0-9_-]+)/);
  const instagramPostMatch = trimmed.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
  
  if (instagramReelMatch || instagramPostMatch) {
    const postId = instagramReelMatch?.[1] || instagramPostMatch?.[1];
    return {
      type: "instagram",
      postId,
      embedUrl: `https://www.instagram.com/p/${postId}/embed/`,
      originalUrl: trimmed,
    };
  }
  
  // YouTube URL patterns
  const youtubePattern = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const youtubeMatch = trimmed.match(youtubePattern);
  if (youtubeMatch) {
    return {
      type: "youtube",
      videoId: youtubeMatch[1],
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      originalUrl: trimmed,
    };
  }
  
  // Direct video file (mp4, webm, etc.)
  if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(trimmed) || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return {
      type: "direct",
      url: trimmed,
    };
  }
  
  // Default to direct (might be a CDN URL or other video host)
  return {
    type: "direct",
    url: trimmed,
  };
}

export default function ReelCarousel({ reels }) {
  const scrollerRef = useRef(null);
  const featuredVideoRef = useRef(null);
  const rafRef = useRef(null);
  const cardWidthRef = useRef(0);
  const activeIndexRef = useRef(0);
  const videoRefs = useRef(new Map()); // Map of reel.id -> video element
  const iframeRefs = useRef(new Map()); // Map of reel.id -> iframe element
  const [activeIndex, setActiveIndex] = useState(0); // index within base reels
  const [mutedById, setMutedById] = useState(() => new Map());
  const [featuredMuted, setFeaturedMuted] = useState(true); // Featured video starts muted
  const [viewedIds, setViewedIds] = useState(() => new Set());
  const [videoReady, setVideoReady] = useState(() => new Set());
  const [videoError, setVideoError] = useState(() => new Set());

  const allReels = Array.isArray(reels) ? reels : [];
  
  // Separate featured reel from regular reels
  const featuredReel = allReels.find(r => r.isFeatured) || null;
  const base = allReels.filter(r => !r.isFeatured);
  const baseCount = base.length;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Auto-play featured video
  useEffect(() => {
    if (!featuredReel || !featuredVideoRef.current) return;
    
    const video = featuredVideoRef.current;
    const videoUrl = featuredReel.videoUrl || featuredReel.url;
    const embedInfo = getVideoEmbedInfo(videoUrl);
    
    // Only handle direct video files for featured
    if (embedInfo.type === "direct" && embedInfo.url) {
      if (!video.src || video.src !== embedInfo.url) {
        video.src = embedInfo.url;
        video.load();
      }
      
      const tryPlay = () => {
        video.muted = featuredMuted;
        video.play().catch((err) => {
          console.warn(`Featured reel autoplay blocked:`, err);
        });
      };
      
      if (video.readyState >= 2) {
        tryPlay();
      } else {
        video.addEventListener("canplay", tryPlay, { once: true });
        video.addEventListener("loadeddata", tryPlay, { once: true });
      }
    }
  }, [featuredReel, featuredMuted]);

  const markReady = (id) => {
    setVideoReady((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setVideoError((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const markError = (id) => {
    setVideoError((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Auto-play videos when they become active (only for direct video files)
  useEffect(() => {
    if (baseCount === 0) return;
    
    const playActiveVideos = () => {
      base.forEach((reel, idx) => {
        const isActive = idx === activeIndex;
        const shouldPlay =
          baseCount <= 2 ||
          isActive ||
          idx === ((activeIndex + 1) % baseCount) ||
          idx === ((activeIndex - 1 + baseCount) % baseCount);

        const video = videoRefs.current.get(reel.id);
        const videoUrl = reel.videoUrl || reel.url;
        const embedInfo = getVideoEmbedInfo(videoUrl);
        
        // Only handle direct video files, not embeds
        if (video && shouldPlay && embedInfo.type === "direct" && embedInfo.url) {
          // Set src if not already set or different
          if (!video.src || video.src !== embedInfo.url) {
            video.src = embedInfo.url;
            video.load();
          }
          
          // Try to play if video is ready
          if (video.readyState >= 2) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log(`Reel ${reel.id} playing successfully`);
                  markReady(reel.id);
                })
                .catch((err) => {
                  console.warn(`Reel ${reel.id} autoplay blocked:`, err);
                });
            }
          } else if (video.readyState >= 1) {
            // Video is loading, wait for it
            const tryPlay = () => {
              video.play().catch(() => {});
            };
            video.addEventListener("canplay", tryPlay, { once: true });
            video.addEventListener("loadeddata", tryPlay, { once: true });
          }
        } else if (video && !shouldPlay) {
          // Pause videos that shouldn't play
          video.pause();
        } else if (embedInfo.type === "instagram" || embedInfo.type === "youtube") {
          // For embeds, mark as ready when they become active (iframe handles loading)
          if (shouldPlay) {
            markReady(reel.id);
          }
        }
      });
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(playActiveVideos, 100);
    return () => clearTimeout(timeoutId);
  }, [activeIndex, baseCount, base]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      const firstCard = el.querySelector("[data-reel-card='1']");
      if (!firstCard) return;
      const w = firstCard.getBoundingClientRect().width;
      if (w > 0) cardWidthRef.current = w;
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // No need to jump to middle - just start at the beginning

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || baseCount === 0) return;

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const cardWidth = cardWidthRef.current || el.querySelector("[data-reel-card='1']")?.getBoundingClientRect().width || 0;
        if (!cardWidth) return;
        const center = el.scrollLeft + el.clientWidth / 2;
        const rawIndex = Math.round(center / cardWidth - 0.5);

        // Clamp to valid range (no infinite loop)
        const normalized = Math.max(0, Math.min(rawIndex, baseCount - 1));
        if (normalized !== activeIndexRef.current) {
          activeIndexRef.current = normalized;
          setActiveIndex(normalized);
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [baseCount]);

  const setMutedFor = (id, nextMuted) => {
    setMutedById((prev) => {
      const m = new Map(prev);
      m.set(id, nextMuted);
      return m;
    });
  };

  const isMuted = (id) => (mutedById.has(id) ? mutedById.get(id) : true);

  const markViewed = async (id) => {
    if (viewedIds.has(id)) return;
    setViewedIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`${API}/reels/${id}/view`, { method: "POST" });
    } catch {
      // ignore
    }
  };

  // Render function for a single reel card
  const renderReelCard = (reel, i, isFeatured = false) => {
    const isActive = !isFeatured && i === activeIndex;
    const shouldPlay =
      isFeatured ||
      baseCount <= 2 ||
      isActive ||
      i === activeIndex + 1 ||
      i === activeIndex - 1;
    const product = reel.product || null;
    const productImg =
      (product?.images && Array.isArray(product.images) && product.images[0]) ||
      (typeof product?.images === "string" ? (() => {
        try {
          const arr = JSON.parse(product.images);
          return Array.isArray(arr) ? arr[0] : null;
        } catch {
          return null;
        }
      })() : null) ||
      reel.thumbnail ||
      null;

    const { low, high } = getLowestAndHighestPrice(product);
    const discountPct = Number.isFinite(Number(reel.discountPct)) ? Number(reel.discountPct) : null;
    const original = discountPct && low ? Math.round((low * 100) / (100 - discountPct)) : null;
    const videoUrl = (reel.videoUrl || reel.url)?.trim();
    const embedInfo = getVideoEmbedInfo(videoUrl);
    const videoIsReady = videoReady.has(reel.id);
    const videoHasError = videoError.has(reel.id);
    const isMutedState = isFeatured ? featuredMuted : isMuted(reel.id);

    return (
      <div
        key={reel.id}
        data-reel-card={isFeatured ? "featured" : "1"}
        className={[
          "shrink-0 snap-center",
          isFeatured 
            ? "basis-full lg:basis-[50%] xl:basis-[40%] mb-4 lg:mb-0" 
            : "basis-[72%] sm:basis-[34%] lg:basis-[22%] xl:basis-[18%]",
          "transition-transform duration-300",
          isFeatured 
            ? "scale-100" 
            : (isActive 
                ? "scale-[1.04] md:scale-100" 
                : "scale-[0.94] opacity-90 md:scale-100 md:opacity-100"),
        ].join(" ")}
      >
        <div className="relative overflow-hidden shadow-md bg-black">
          {/* Instagram Reels: 1080 x 1920 pixels = 9:16 aspect ratio = 177.78% */}
          <div className="relative w-full" style={{ paddingBottom: "177.78%" }}>
            {videoUrl ? (
              <>
                {(!videoIsReady || videoHasError) && embedInfo.type !== "instagram" && embedInfo.type !== "youtube" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                    {productImg ? (
                      <img
                        src={productImg}
                        alt={product?.name || reel.title || "Reel"}
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="text-center z-10">
                        <img src="/logo.png" alt="Gift Choice Logo" className="h-10 w-auto mx-auto mb-2 object-contain opacity-50 animate-pulse" />
                        <div className="text-white/70 text-xs font-semibold">Loading reel...</div>
                      </div>
                    )}
                  </div>
                )}

                {embedInfo.type === "instagram" && (
                  <>
                    <iframe
                      src={embedInfo.embedUrl}
                      className="absolute inset-0 w-full h-full"
                      frameBorder="0"
                      scrolling="no"
                      allow="encrypted-media"
                      loading="lazy"
                      onLoad={() => markReady(reel.id)}
                      onError={() => {
                        console.error(`Reel ${reel.id} Instagram embed error`);
                        markError(reel.id);
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        overflow: "hidden",
                      }}
                    />
                    {!videoReady.has(reel.id) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 pointer-events-none">
                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                          <svg className="w-8 h-8 text-black ml-1" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {embedInfo.type === "youtube" && (
                  <>
                    <iframe
                      ref={(el) => {
                        if (el) {
                          iframeRefs.current.set(reel.id, el);
                        } else {
                          iframeRefs.current.delete(reel.id);
                        }
                      }}
                      src={`${embedInfo.embedUrl}?autoplay=${shouldPlay ? 1 : 0}&mute=${isMutedState ? 1 : 0}&loop=1&playlist=${embedInfo.videoId}&controls=0`}
                      className="absolute inset-0 w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      onLoad={() => {
                        console.log(`Reel ${reel.id} YouTube embed loaded`);
                        markReady(reel.id);
                      }}
                      onError={() => {
                        console.error(`Reel ${reel.id} YouTube embed error`);
                        markError(reel.id);
                      }}
                    />
                    <button
                      onClick={() => {
                        if (isFeatured) {
                          setFeaturedMuted(!featuredMuted);
                          const video = featuredVideoRef.current;
                          if (video) {
                            video.muted = !featuredMuted;
                          }
                        } else {
                          const newMuteState = !isMuted(reel.id);
                          setMutedFor(reel.id, newMuteState);
                          const iframe = iframeRefs.current.get(reel.id);
                          if (iframe) {
                            iframe.src = `${embedInfo.embedUrl}?autoplay=1&mute=${newMuteState ? 1 : 0}&loop=1&playlist=${embedInfo.videoId}&controls=0`;
                          }
                        }
                      }}
                      className="absolute top-3 right-12 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-all duration-200 active:scale-95"
                      aria-label={isMutedState ? "Unmute" : "Mute"}
                      title={isMutedState ? "Click to unmute" : "Click to mute"}
                    >
                      {isMutedState ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                    </button>
                  </>
                )}

                {embedInfo.type === "direct" && (
                  <>
                    <video
                      ref={(el) => {
                        if (isFeatured) {
                          featuredVideoRef.current = el;
                        } else {
                          if (el) {
                            videoRefs.current.set(reel.id, el);
                            if (shouldPlay && embedInfo.url && el.src !== embedInfo.url) {
                              el.src = embedInfo.url;
                              el.load();
                            }
                          } else {
                            videoRefs.current.delete(reel.id);
                          }
                        }
                      }}
                      className={[
                        "absolute inset-0 w-full h-full object-cover",
                        videoIsReady && !videoHasError ? "opacity-100" : "opacity-0",
                        "transition-opacity duration-500",
                      ].join(" ")}
                      src={shouldPlay && embedInfo.url ? embedInfo.url : undefined}
                      poster={productImg || undefined}
                      playsInline
                      loop
                      muted={isMutedState}
                      autoPlay
                      preload="auto"
                      onLoadedData={(e) => {
                        const video = e.target;
                        console.log(`Reel ${reel.id} loaded data, readyState:`, video.readyState);
                        markReady(reel.id);
                        if (shouldPlay) {
                          requestAnimationFrame(() => {
                            video.play().catch((err) => {
                              console.warn(`Reel ${reel.id} autoplay blocked:`, err);
                            });
                          });
                        }
                      }}
                      onCanPlay={(e) => {
                        const video = e.target;
                        video.muted = isMutedState;
                        console.log(`Reel ${reel.id} can play`);
                        markReady(reel.id);
                        if (shouldPlay) {
                          requestAnimationFrame(() => {
                            video.play().catch((err) => {
                              console.warn(`Reel ${reel.id} play failed:`, err);
                            });
                          });
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const video = e.target;
                        console.log(`Reel ${reel.id} metadata loaded, readyState:`, video.readyState);
                        markReady(reel.id);
                        if (shouldPlay && video.readyState >= 2) {
                          requestAnimationFrame(() => {
                            video.play().catch((err) => {
                              console.warn(`Reel ${reel.id} metadata play failed:`, err);
                            });
                          });
                        }
                      }}
                      onPlaying={() => {
                        console.log(`Reel ${reel.id} is playing`);
                        markReady(reel.id);
                      }}
                      onError={(e) => {
                        const video = e.target;
                        console.error(`Video error for reel ${reel.id}:`, {
                          url: embedInfo.url,
                          error: video.error,
                          code: video.error?.code,
                          message: video.error?.message,
                        });
                        markError(reel.id);
                      }}
                      onPlay={() => markViewed(reel.id)}
                    />
                    <button
                      onClick={() => {
                        if (isFeatured) {
                          setFeaturedMuted(!featuredMuted);
                          const video = featuredVideoRef.current;
                          if (video) {
                            video.muted = !featuredMuted;
                          }
                        } else {
                          const video = videoRefs.current.get(reel.id);
                          if (video) {
                            video.muted = !isMuted(reel.id);
                            setMutedFor(reel.id, !isMuted(reel.id));
                          }
                        }
                      }}
                      className="absolute top-3 right-2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-all duration-200 active:scale-95"
                      aria-label={isMutedState ? "Unmute" : "Mute"}
                      title={isMutedState ? "Click to unmute" : "Click to mute"}
                    >
                      {isMutedState ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-900 to-black">
                <div className="text-center px-6 z-10">
                  <img src="/logo.png" alt="Gift Choice Logo" className="h-10 w-auto mx-auto mb-3 object-contain opacity-50" />
                  <div className="text-white font-semibold">Reel video missing</div>
                  <div className="text-white/70 text-sm mt-1">Add a reel video URL in Admin</div>
                </div>
              </div>
            )}

            {/* Top overlays */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {isFeatured && (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-pink-500 text-white shadow">
                  Featured
                </span>
              )}
              {reel.isTrending && (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-white/90 text-gray-900 shadow">
                  Trending
                </span>
              )}
              {discountPct ? (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-pink-500 text-white shadow">
                  {discountPct}% OFF
                </span>
              ) : null}
            </div>

            {/* Bottom overlays */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
              <div className="flex items-end gap-3">
                {productImg && (
                  <img
                    src={productImg}
                    alt={product?.name || reel.title || "Product"}
                    className="w-12 h-12 rounded-xl object-cover shadow bg-white"
                    loading="lazy"
                    decoding="async"
                    width={48}
                    height={48}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold text-sm line-clamp-1">
                    {product?.name || reel.title || "Reel"}
                  </div>
                  {(low || original) && (
                    <div className="flex items-baseline gap-2">
                      {low ? (
                        <div className="text-white font-bold text-base">{formatINR(low)}</div>
                      ) : null}
                      {original ? (
                        <div className="text-white/70 text-sm line-through">{formatINR(original)}</div>
                      ) : null}
                      {high && low && high !== low ? (
                        <div className="text-white/70 text-xs"></div>
                      ) : null}
                    </div>
                  )}
                  {(embedInfo.type === "direct" || embedInfo.type === "youtube") && (
                    <div className="text-white/70 text-[11px] mt-1">
                      Tap to {isMutedState ? "unmute" : "mute"}
                    </div>
                  )}
                  {embedInfo.type === "instagram" && (
                    <div className="text-white/70 text-[11px] mt-1">
                      Tap to play
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (baseCount === 0 && !featuredReel) return null;

  return (
    <div className="w-full">
      {/* Featured Reel - Center */}
      {featuredReel && (
        <div className="flex justify-center mb-6">
          {renderReelCard(featuredReel, -1, true)}
        </div>
      )}

      {/* Regular Reels Feed */}
      {baseCount > 0 && (
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {base.map((reel, i) => renderReelCard(reel, i, false))}
        </div>
      )}
    </div>
  );
}

export const MemoReelCarousel = memo(ReelCarousel);

