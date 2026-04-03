import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ── Available tile layer styles (all free, no API key needed) ────────────
 *
 * CartoDB Positron — Clean, light minimal style, great for modern UIs
 *   url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
 *   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
 *
 * CartoDB Dark Matter — Dark theme map, sleek look
 *   url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
 *   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
 *
 * Stadia Alidade Smooth — Soft pastel tones, very polished
 *   url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
 *   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
 *
 * Esri World Street Map (active) — Detailed, Google Maps-like appearance
 *   url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
 *   attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
 *
 * OpenTopoMap — Topographic / terrain style
 *   url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
 *   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
 *
 * OpenStreetMap (default) — Standard community-maintained map
 *   url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 *   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
 * ──────────────────────────────────────────────────────────────────────── */
const TILE_URL = "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>';

/* ── Fix Leaflet's default marker icon (broken paths in bundlers) ────────── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ── Nominatim reverse-geocode (free, no key) ───────────────────────────── */
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": "shoposphere/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const addressLine = [
      a.house_number,
      a.road,
      a.neighbourhood || a.suburb || a.hamlet,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      addressLine: addressLine || data.display_name?.split(",").slice(0, 2).join(",").trim() || "",
      city: a.city || a.town || a.village || a.county || "",
      state: a.state || "",
      pincode: a.postcode || "",
      latitude: lat,
      longitude: lng,
    };
  } catch {
    return { addressLine: "", city: "", state: "", pincode: "", latitude: lat, longitude: lng };
  }
}

/* ── Nominatim forward search (autocomplete replacement) ─────────────── */
async function searchAddress(query) {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=in&accept-language=en`,
      { headers: { "User-Agent": "shoposphere/1.0" } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/* ── Sub-component: handles map click → moves marker + reverse geocodes ── */
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/* ── Sub-component: flies map to new position ────────────────────────── */
function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 16, { duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

/**
 * LocationPicker — Leaflet + OpenStreetMap replacement for GoogleAddressInput.
 *
 * Features:
 * - Text search via Nominatim (free)
 * - Click/tap map to drop pin → reverse geocode
 * - "Use my location" button (browser geolocation API)
 * - Draggable marker for fine-tuning
 *
 * Props:
 *   onChange({ addressLine, city, state, pincode, latitude, longitude })
 *   initialLat, initialLng — starting position (optional)
 *   placeholder
 *   showMap — render the map (default true)
 *   className, style — for the search input
 */
export default function LocationPicker({
  onChange,
  initialLat = null,
  initialLng = null,
  placeholder = "Search address or tap map to drop pin",
  showMap = true,
  className = "",
  style = {},
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [markerPos, setMarkerPos] = useState(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null
  );
  const [mapCenter, setMapCenter] = useState(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : [28.6139, 77.209] // Default: New Delhi
  );
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const searchTimerRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced forward search
  const handleSearchChange = (value) => {
    setQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const data = await searchAddress(value);
      setResults(data);
      setShowResults(data.length > 0);
    }, 400);
  };

  // When a search result is selected
  const handleResultSelect = async (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setMarkerPos([lat, lng]);
    setMapCenter([lat, lng]);
    setQuery(item.display_name?.split(",").slice(0, 3).join(",").trim() || "");
    setShowResults(false);

    const a = item.address || {};
    const addressLine = [a.house_number, a.road, a.neighbourhood || a.suburb || a.hamlet]
      .filter(Boolean)
      .join(", ");
    onChange?.({
      addressLine: addressLine || item.display_name?.split(",").slice(0, 2).join(",").trim() || "",
      city: a.city || a.town || a.village || a.county || "",
      state: a.state || "",
      pincode: a.postcode || "",
      latitude: lat,
      longitude: lng,
    });
  };

  // When map is clicked or marker dragged
  const handleLocationSelect = useCallback(
    async (lat, lng) => {
      setMarkerPos([lat, lng]);
      setGeocoding(true);
      const data = await reverseGeocode(lat, lng);
      setGeocoding(false);
      if (data) {
        setQuery(
          [data.addressLine, data.city].filter(Boolean).join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        );
        onChange?.(data);
      }
    },
    [onChange]
  );

  // "Use my location" — browser geolocation
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos([lat, lng]);
        setMapCenter([lat, lng]);
        setGeocoding(true);
        const data = await reverseGeocode(lat, lng);
        setGeocoding(false);
        if (data) {
          setQuery([data.addressLine, data.city].filter(Boolean).join(", "));
          onChange?.(data);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {/* Search input + locate button */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder={placeholder}
            className={className}
            style={style}
            autoComplete="off"
          />
          {geocoding && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
            </div>
          )}
          {/* Dropdown results */}
          {showResults && results.length > 0 && (
            <ul
              className="absolute z-50 left-0 right-0 mt-1 rounded-lg border shadow-lg max-h-52 overflow-y-auto"
              style={{ background: "var(--background)", borderColor: "var(--border)" }}
            >
              {results.map((item, i) => (
                <li
                  key={item.place_id || i}
                  onClick={() => handleResultSelect(item)}
                  className="px-3 py-2.5 text-sm cursor-pointer hover:bg-[var(--muted)] transition-colors border-b last:border-b-0"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {item.display_name?.length > 80
                    ? item.display_name.slice(0, 80) + "…"
                    : item.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Use my location button */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          title="Use my current location"
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border transition-all hover:shadow-md disabled:opacity-50"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            color: "var(--primary)",
          }}
        >
          {locating ? (
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a1 1 0 011 1v2.07A8.003 8.003 0 0118.93 11H21a1 1 0 110 2h-2.07A8.003 8.003 0 0113 18.93V21a1 1 0 11-2 0v-2.07A8.003 8.003 0 015.07 13H3a1 1 0 110-2h2.07A8.003 8.003 0 0111 5.07V3a1 1 0 011-1zm0 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z" />
            </svg>
          )}
        </button>
      </div>

      {/* Map */}
      {showMap && (
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)", height: "220px" }}>
          <MapContainer
            center={mapCenter}
            zoom={markerPos ? 16 : 12}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution={TILE_ATTRIBUTION}
              url={TILE_URL}
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            <FlyTo lat={mapCenter[0]} lng={mapCenter[1]} />
            {markerPos && (
              <Marker
                position={markerPos}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    handleLocationSelect(lat, lng);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
      )}

      {/* Hint text */}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Tap the map to drop a pin, or use the{" "}
        <button type="button" onClick={handleUseMyLocation} className="underline" style={{ color: "var(--primary)" }}>
          locate me
        </button>{" "}
        button for GPS accuracy
      </p>
    </div>
  );
}
