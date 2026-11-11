import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LuLocateFixed, LuArrowRight } from "react-icons/lu";
import { MoneyUtils } from "@/utils";
import type { Cancha } from "@/types";

interface Coords {
  lat: number;
  lng: number;
}

type CanchaConCoords = Cancha & { latitud: number; longitud: number; distanciaKm?: number };

const CANTIDAD_CERCANAS = 5;
// Radio para agrupar canchas cuando no hay ubicación (así el mapa no se abre sobre todo el país).
const RADIO_CLUSTER_KM = 30;

// Pin propio (divIcon) en vez del ícono por defecto de Leaflet, que con bundlers pierde sus imágenes.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <path d="M15 1C7.8 1 2 6.8 2 14c0 9.6 13 23 13 23s13-13.4 13-23C28 6.8 22.2 1 15 1z" fill="#047857" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="14" r="5" fill="#fff"/></svg>`,
  iconSize: [30, 38],
  iconAnchor: [15, 37],
  popupAnchor: [0, -32],
});

function distanciaKm(a: Coords, b: Coords): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Sin ubicación: el grupo de canchas con más vecinas cerca, para encuadrar el mapa ahí. */
function grupoPrincipal(canchas: CanchaConCoords[]): CanchaConCoords[] {
  let mejor: CanchaConCoords[] = [];
  for (const c of canchas) {
    const grupo = canchas.filter(
      (o) => distanciaKm({ lat: c.latitud, lng: c.longitud }, { lat: o.latitud, lng: o.longitud }) <= RADIO_CLUSTER_KM,
    );
    if (grupo.length > mejor.length) mejor = grupo;
  }
  return mejor;
}

function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!puntos.length) return;
    if (puntos.length === 1) map.setView(puntos[0], 15);
    else map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
  }, [map, puntos]);
  return null;
}

export function CanchasMapa({ canchas }: { canchas: Cancha[] }) {
  const navigate = useNavigate();
  const [ubicacion, setUbicacion] = useState<Coords | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");

  const conCoords = useMemo(() => {
    const validas = canchas.filter(
      (c): c is CanchaConCoords => c.estado === "disponible" && c.latitud != null && c.longitud != null,
    );
    if (!ubicacion) return validas;
    return validas
      .map((c) => ({ ...c, distanciaKm: distanciaKm(ubicacion, { lat: c.latitud, lng: c.longitud }) }))
      .sort((a, b) => a.distanciaKm! - b.distanciaKm!);
  }, [canchas, ubicacion]);

  const puntos = useMemo<[number, number][]>(() => {
    if (ubicacion) {
      return [[ubicacion.lat, ubicacion.lng], ...conCoords.slice(0, CANTIDAD_CERCANAS).map((c): [number, number] => [c.latitud, c.longitud])];
    }
    return grupoPrincipal(conCoords).map((c): [number, number] => [c.latitud, c.longitud]);
  }, [ubicacion, conCoords]);

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no soporta geolocalización.");
      return;
    }
    setBuscando(true);
    setAviso("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacion({ lat: coords.latitude, lng: coords.longitude });
        setBuscando(false);
      },
      (err) => {
        setAviso(
          err.code === err.PERMISSION_DENIED
            ? "No pudimos usar tu ubicación. Habilitá el permiso del navegador (requiere HTTPS) y probá de nuevo."
            : "No pudimos obtener tu ubicación. Probá de nuevo en un momento.",
        );
        setBuscando(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  if (!conCoords.length) return null;

  const cercanas = ubicacion ? conCoords.slice(0, CANTIDAD_CERCANAS) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">
          {ubicacion
            ? `La más cercana está a ${conCoords[0].distanciaKm!.toFixed(1)} km de vos.`
            : "Tocá un pin para ver la cancha. Activá tu ubicación para ver las más cercanas."}
        </p>
        <button type="button" className="btn btn-outline text-[13px]" onClick={usarMiUbicacion} disabled={buscando}>
          <LuLocateFixed size={15} /> {buscando ? "Buscando…" : ubicacion ? "Actualizar ubicación" : "Usar mi ubicación"}
        </button>
      </div>
      {aviso && <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{aviso}</p>}

      <div className="rounded-2xl overflow-hidden border border-slate-200/80 h-[420px] relative z-0" style={{ boxShadow: "var(--shadow-card)" }}>
        <MapContainer center={[-34.6, -58.45]} zoom={12} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Encuadre puntos={puntos} />
          {ubicacion && (
            <CircleMarker
              center={[ubicacion.lat, ubicacion.lng]}
              radius={9}
              pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
            >
              <Popup>Estás acá</Popup>
            </CircleMarker>
          )}
          {conCoords.map((c) => (
            <Marker key={c.id} position={[c.latitud, c.longitud]} icon={pinIcon}>
              <Popup>
                <div className="flex flex-col gap-1 min-w-[170px]">
                  <strong className="text-[14px] text-slate-900">{c.nombre}</strong>
                  {(c.zona || c.distanciaKm != null) && (
                    <span className="text-[12px] text-slate-500">
                      {[c.zona, c.distanciaKm != null && `a ${c.distanciaKm.toFixed(1)} km`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <span className="text-[14px] font-extrabold text-brand-700">
                    {MoneyUtils.formatear(c.precioPorHora)}
                    <span className="text-[11px] text-slate-400 font-medium">/hora</span>
                  </span>
                  <button type="button" className="btn btn-primary text-[12px] py-1 mt-1" onClick={() => navigate(`/reservar?cancha=${c.id}`)}>
                    Reservar <LuArrowRight size={12} />
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {!!cercanas.length && (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {cercanas.map((c, i) => (
            <li key={c.id} className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-[13px]">
              <span className="text-[11px] font-bold text-brand-700">#{i + 1} · {c.distanciaKm!.toFixed(1)} km</span>
              <p className="font-semibold text-slate-900 leading-tight">{c.nombre}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
