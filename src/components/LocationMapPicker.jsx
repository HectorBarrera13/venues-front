// src/features/venues/components/LocationMapPicker.jsx
//
// Task 9: lets the person pick the venue's location by clicking on a map
// instead of typing it as free text. Uses Leaflet + OpenStreetMap tiles
// (no API key required) and OpenStreetMap's Nominatim service for both
// directions: reverse geocoding (map click -> address) and forward
// geocoding (typed search -> candidates, so someone who doesn't
// recognize the map visually can search instead and still see the pin
// land on the right spot). The venue's `location` is still just a
// string on the way out — the backend and Venue entity never see
// coordinates — so nothing else in the app needs to change.
//
// The text field under the map is read-only: it only ever reflects what
// the map/search picked, so it works as a plain confirmation of the
// selected point rather than a place someone could type an unrelated
// address into.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite doesn't resolve Leaflet's default marker image paths on its own;
// point them at the bundled asset URLs once for the whole app.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [20.9674, -89.5926]; // Mérida, Yucatán
const DEFAULT_ZOOM = 13;
const SEARCH_DEBOUNCE_MS = 450;
const MIN_SEARCH_LENGTH = 3;

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok)
    throw new Error("No pudimos obtener la dirección de ese punto.");

  const payload = await response.json().catch(() => null);
  if (!payload?.display_name)
    throw new Error("Ese punto no tiene una dirección conocida.");
  return payload.display_name;
}

async function searchAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=0&limit=5`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error("No pudimos buscar esa dirección.");

  const payload = await response.json().catch(() => []);
  return (Array.isArray(payload) ? payload : []).map((item) => ({
    id: item.place_id,
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

function ClickToPick({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

// Imperative pan/zoom: react-leaflet's <MapContainer> only sets the
// view once on mount, so moving the map after a search result or a new
// `value` needs the underlying Leaflet map instance via useMap().
function FlyToPosition({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo(target.center, target.zoom, { duration: 0.75 });
  }, [target, map]);

  return null;
}

// Mouse-wheel zoom starts disabled (so scrolling the page over the map
// doesn't get hijacked into zooming it) and turns on only once the
// person clicks inside the map — the same gesture <ClickToPick> uses to
// drop a pin — then turns back off once the cursor leaves the map, the
// same pattern embedded Google Maps uses.
function ScrollZoomOnDemand({ onEnabledChange }) {
  const map = useMap();

  useEffect(() => {
    map.scrollWheelZoom.disable();

    function enable() {
      map.scrollWheelZoom.enable();
      onEnabledChange(true);
    }
    function disable() {
      map.scrollWheelZoom.disable();
      onEnabledChange(false);
    }

    map.on("click", enable);
    const container = map.getContainer();
    container.addEventListener("mouseleave", disable);

    return () => {
      map.off("click", enable);
      container.removeEventListener("mouseleave", disable);
    };
  }, [map, onEnabledChange]);

  return null;
}

// Invalidate Leaflet map size on mount and after short delays so that
// when embedded in animated containers or modal dialogs, tiles render completely.
function InvalidateMapSize() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  return null;
}

/**
 * @param {{
 *   id?: string,
 *   value: string,
 *   onChange: (address: string) => void,
 * }} props
 */
function LocationMapPicker({ id, value, onChange }) {
  const [position, setPosition] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [statusMessage, setStatusMessage] = useState("");
  const pickRequestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle"); // idle | loading | empty | error
  const searchRequestIdRef = useRef(0);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(searchDebounceRef.current);
  }, []);

  // When an initial value is provided (e.g. editing an existing venue),
  // locate it on the map and drop the pin at that location.
  useEffect(() => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    let isCancelled = false;
    const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      const timer = setTimeout(() => {
        if (isCancelled) return;
        setPosition((prev) => prev || [lat, lng]);
        setFlyTarget((prev) => prev || { center: [lat, lng], zoom: 16 });
      }, 0);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    }

    searchAddress(trimmed)
      .then((results) => {
        if (isCancelled || !results?.length) return;
        const first = results[0];
        setPosition((prev) => prev || [first.lat, first.lng]);
        setFlyTarget((prev) => prev || { center: [first.lat, first.lng], zoom: 16 });
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [value]);

  const pickPoint = useCallback(
    (lat, lng, label) => {
      setPosition([lat, lng]);
      setFlyTarget({ center: [lat, lng], zoom: 16 });

      if (label) {
        setStatus("idle");
        onChange(label);
        return;
      }

      setStatus("loading");
      setStatusMessage("");
      const requestId = (pickRequestIdRef.current += 1);

      reverseGeocode(lat, lng)
        .then((address) => {
          if (pickRequestIdRef.current !== requestId) return; // a newer pick superseded this one
          setStatus("idle");
          onChange(address);
        })
        .catch((error) => {
          if (pickRequestIdRef.current !== requestId) return;
          setStatus("error");
          setStatusMessage(error.message);
          // The field is read-only now, so it still needs *something* that
          // confirms a point was picked — fall back to the raw coordinates
          // when Nominatim can't turn them into a readable address.
          onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        });
    },
    [onChange],
  );

  function handleSearchChange(event) {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    clearTimeout(searchDebounceRef.current);

    const trimmed = nextQuery.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setSuggestions([]);
      setSearchStatus("idle");
      return;
    }

    setSearchStatus("loading");
    searchDebounceRef.current = setTimeout(() => {
      const requestId = (searchRequestIdRef.current += 1);
      searchAddress(trimmed)
        .then((results) => {
          if (searchRequestIdRef.current !== requestId) return; // a newer search superseded this one
          setSuggestions(results);
          setSearchStatus(results.length ? "idle" : "empty");
        })
        .catch(() => {
          if (searchRequestIdRef.current !== requestId) return;
          setSuggestions([]);
          setSearchStatus("error");
        });
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelectSuggestion(suggestion) {
    clearTimeout(searchDebounceRef.current);
    setQuery("");
    setSuggestions([]);
    setSearchStatus("idle");
    pickPoint(suggestion.lat, suggestion.lng, suggestion.label);
  }

  return (
    <div className="location-picker">
      <div className="location-picker-search">
        <div className="location-picker-search-box">
          <svg
            className="location-picker-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="Busca una dirección para ubicarla en el mapa"
            aria-label="Buscar dirección en el mapa"
            autoComplete="off"
          />
        </div>
        {suggestions.length > 0 && (
          <ul className="location-picker-suggestions" role="listbox">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  className="location-picker-suggestion"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => {
                    event.preventDefault(); // keep focus so the click isn't lost to a blur first
                    handleSelectSuggestion(suggestion);
                  }}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchStatus === "loading" && (
          <p className="location-picker-status">Buscando direcciones…</p>
        )}
        {searchStatus === "empty" && (
          <p className="location-picker-status">
            Sin resultados para esa búsqueda.
          </p>
        )}
        {searchStatus === "error" && (
          <p className="location-picker-status">
            No pudimos buscar esa dirección.
          </p>
        )}
      </div>

      <div className="location-picker-map">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InvalidateMapSize />
          <ClickToPick onPick={pickPoint} />
          <FlyToPosition target={flyTarget} />
          <ScrollZoomOnDemand onEnabledChange={setScrollZoomEnabled} />
          {position && <Marker position={position} />}
        </MapContainer>
        {!scrollZoomEnabled && (
          <div className="location-picker-zoom-hint" aria-hidden="true">
            Da clic en el mapa para activar el zoom con la rueda del mouse
          </div>
        )}
      </div>

      <p className="location-picker-hint">
        Busca la dirección arriba o da clic directamente en el mapa para
        marcarla.
      </p>

      {status === "loading" && (
        <p className="location-picker-status">
          Obteniendo la dirección de ese punto…
        </p>
      )}
      {status === "error" && (
        <p className="form-error" role="alert">
          {statusMessage} Se muestran las coordenadas mientras tanto — intenta
          buscar o marcar de nuevo.
        </p>
      )}

      <input
        id={id}
        type="text"
        className="location-picker-address"
        value={value}
        readOnly
        placeholder="Aparecerá aquí al buscar una dirección o marcarla en el mapa"
        aria-describedby={id ? `${id}-hint` : undefined}
      />
    </div>
  );
}

export default LocationMapPicker;
