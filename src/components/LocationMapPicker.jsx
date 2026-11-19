// src/components/LocationMapPicker.jsx
//
// Task 9: lets the person pick the venue's location by clicking on a map
// instead of typing it as free text. Uses Leaflet + OpenStreetMap tiles
// (no API key required) and OpenStreetMap's Nominatim service for both
// directions: reverse geocoding (map click -> address) and forward
// geocoding (typed search -> candidates, so someone who doesn't
// recognize the map visually can search instead and still see the pin
// land on the right spot).
//
// Two outputs (VEN-401):
// - `onChange(label)` keeps emitting the human-readable string, so the
//   existing forms keep working unchanged.
// - `onPlaceChange(place)` (optional) emits the structured geography the
//   venue-service contract needs: { lat, lng, name, address, city, country,
//   externalId, externalSource, osmRef, displayName } — see
//   services/nominatimPlace.js. Fields Nominatim doesn't return are null.
//   It emits `null` when a clicked point couldn't be resolved because the
//   map service failed, so the form has no point to submit.
//
// Provider failures (VEN-406) stay inside the picker: no results says so,
// a network/5xx failure shows a retry button, and none of it ever calls the
// venue-service. Searches are debounced and every new one aborts the
// previous request (services/placeSearch.js).
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
import { coordinatesOnlyPlace } from "../services/nominatimPlace.js";
import { reversePlace, searchPlaces } from "../services/nominatimClient.js";
import { createPlaceSearch } from "../services/placeSearch.js";

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
 *   onPlaceChange?: (place: import("../services/nominatimPlace.js").VenuePlace | null) => void,
 * }} props
 */
function LocationMapPicker({ id, value, onChange, onPlaceChange }) {
  const [position, setPosition] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState(false);
  // idle | loading | no-address | error
  const [pickStatus, setPickStatus] = useState("idle");
  const [failedPoint, setFailedPoint] = useState(null);
  const pickControllerRef = useRef(null);

  const [query, setQuery] = useState("");
  // { status: idle | loading | results | empty | error, results }
  const [search, setSearch] = useState({ status: "idle", results: [] });
  const searchRef = useRef(null);

  useEffect(() => {
    const placeSearch = createPlaceSearch({
      search: (text, { signal }) => searchPlaces(text, { signal }),
      onChange: ({ status, results }) => setSearch({ status, results }),
    });
    searchRef.current = placeSearch;
    return () => {
      placeSearch.cancel();
      pickControllerRef.current?.abort();
    };
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

    const controller = new AbortController();
    searchPlaces(trimmed, { signal: controller.signal })
      .then((results) => {
        if (isCancelled || !results?.length) return;
        const first = results[0];
        setPosition((prev) => prev || [first.lat, first.lng]);
        setFlyTarget((prev) => prev || { center: [first.lat, first.lng], zoom: 16 });
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [value]);

  const resolvePoint = useCallback(
    (lat, lng) => {
      pickControllerRef.current?.abort(); // a newer click supersedes the previous lookup
      const controller = new AbortController();
      pickControllerRef.current = controller;
      setPickStatus("loading");
      setFailedPoint(null);

      reversePlace(lat, lng, { signal: controller.signal })
        .then((place) => {
          if (pickControllerRef.current !== controller) return;
          pickControllerRef.current = null;
          if (place) {
            setPickStatus("idle");
            onChange(place.displayName);
            onPlaceChange?.(place);
            return;
          }
          // A real point with no known address: keep the coordinates and let
          // the form ask for the address fields (VEN-402).
          setPickStatus("no-address");
          onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          onPlaceChange?.(coordinatesOnlyPlace(lat, lng));
        })
        .catch((error) => {
          if (error?.name === "AbortError" || pickControllerRef.current !== controller) return;
          pickControllerRef.current = null;
          // The map service failed: there is no usable place until a retry works.
          setPickStatus("error");
          setFailedPoint({ lat, lng });
          onChange("");
          onPlaceChange?.(null);
        });
    },
    [onChange, onPlaceChange],
  );

  const pickPoint = useCallback(
    (lat, lng, label, place) => {
      setPosition([lat, lng]);
      setFlyTarget({ center: [lat, lng], zoom: 16 });

      if (label) {
        pickControllerRef.current?.abort();
        pickControllerRef.current = null;
        setPickStatus("idle");
        setFailedPoint(null);
        onChange(label);
        onPlaceChange?.(place ?? coordinatesOnlyPlace(lat, lng));
        return;
      }
      resolvePoint(lat, lng);
    },
    [onChange, onPlaceChange, resolvePoint],
  );

  function handleSearchChange(event) {
    setQuery(event.target.value);
    searchRef.current?.setQuery(event.target.value);
  }

  function handleSelectSuggestion(suggestion) {
    searchRef.current?.cancel();
    setQuery("");
    setSearch({ status: "idle", results: [] });
    pickPoint(suggestion.lat, suggestion.lng, suggestion.label, suggestion.place);
  }

  const suggestions = search.status === "results" ? search.results : [];

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
        {search.status === "loading" && (
          <p className="location-picker-status">Buscando direcciones…</p>
        )}
        {search.status === "empty" && (
          <p className="location-picker-status" role="status">
            No encontramos ese lugar. Prueba con otra búsqueda o márcalo
            directamente en el mapa.
          </p>
        )}
        {search.status === "error" && (
          <div className="location-picker-retry" role="alert">
            <p className="form-error">
              No pudimos conectar con el servicio de mapas.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => searchRef.current?.retry()}
            >
              Reintentar búsqueda
            </button>
          </div>
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

      {pickStatus === "loading" && (
        <p className="location-picker-status">
          Obteniendo la dirección de ese punto…
        </p>
      )}
      {pickStatus === "no-address" && (
        <p className="location-picker-status" role="status">
          No encontramos una dirección para ese punto. Se muestran sus
          coordenadas: completa los datos que falten o marca otro punto.
        </p>
      )}
      {pickStatus === "error" && failedPoint && (
        <div className="location-picker-retry" role="alert">
          <p className="form-error">
            No pudimos obtener la dirección de ese punto porque el servicio de
            mapas no respondió.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => resolvePoint(failedPoint.lat, failedPoint.lng)}
          >
            Reintentar
          </button>
        </div>
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
