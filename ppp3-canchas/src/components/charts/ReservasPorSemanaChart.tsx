import { useState } from "react";
import type { ReservasPorSemana } from "@/types";
import { nicioTicks, barraPuntaRedondeada } from "./chart.utils";

const W = 320;
const H = 170;
const MARGIN = { top: 24, right: 8, bottom: 22, left: 26 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;

function etiquetaSemana(semana: string): string {
  return `${semana.slice(8, 10)}/${semana.slice(5, 7)}`;
}

export function ReservasPorSemanaChart({ data }: { data: ReservasPorSemana[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);

  const max = Math.max(...data.map((d) => d.cantidad), 1);
  const ticks = nicioTicks(max);
  const escalaMax = ticks[ticks.length - 1];
  const y = (v: number) => PLOT_H - (v / escalaMax) * PLOT_H;

  const n = Math.max(data.length, 1);
  const slot = PLOT_W / n;
  const barW = Math.min(24, slot * 0.5);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end mb-1 flex-shrink-0">
        <button
          type="button"
          className="text-[11px] font-semibold text-slate-400 hover:text-brand-700 transition-colors"
          onClick={() => setTabla((v) => !v)}
        >
          {tabla ? "Ver gráfico" : "Ver como tabla"}
        </button>
      </div>

      {tabla ? (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="font-semibold py-1.5">Semana</th>
              <th className="font-semibold py-1.5 text-right">Reservas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.semana} className="border-b border-slate-50">
                <td className="py-1.5 text-slate-600">{etiquetaSemana(d.semana)}</td>
                <td className="py-1.5 text-right font-semibold text-slate-900 tabular-nums">{d.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative w-full flex-1 min-h-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full block"
            role="img"
            aria-label="Reservas por semana"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={0}
                    x2={PLOT_W}
                    y1={y(t)}
                    y2={y(t)}
                    className="stroke-slate-200"
                    strokeWidth={1}
                  />
                  <text x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 text-[9px]">
                    {t}
                  </text>
                </g>
              ))}
              <line x1={0} x2={PLOT_W} y1={PLOT_H} y2={PLOT_H} className="stroke-slate-300" strokeWidth={1} />

              {data.map((d, i) => {
                const cx = i * slot + slot / 2;
                const x = cx - barW / 2;
                const h = (d.cantidad / escalaMax) * PLOT_H;
                const esUltima = i === data.length - 1;
                const activo = hover === i;
                return (
                  <g key={d.semana}>
                    {/* hit target más ancho que la barra para el hover/foco */}
                    <rect
                      x={i * slot}
                      y={0}
                      width={slot}
                      height={PLOT_H}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      tabIndex={0}
                      role="img"
                      aria-label={`Semana del ${etiquetaSemana(d.semana)}: ${d.cantidad} reservas`}
                    />
                    <path
                      d={barraPuntaRedondeada(x, PLOT_H - h, barW, h, 4)}
                      className={activo || esUltima ? "fill-brand-700" : "fill-brand-600"}
                      style={{ transition: "fill 0.15s" }}
                    />
                    {esUltima && (
                      <text
                        x={cx}
                        y={PLOT_H - h - 8}
                        textAnchor="middle"
                        className="fill-slate-700 text-[11px] font-bold"
                      >
                        {d.cantidad}
                      </text>
                    )}
                    <text
                      x={cx}
                      y={PLOT_H + 18}
                      textAnchor="middle"
                      className="fill-slate-400 text-[9.5px]"
                    >
                      {etiquetaSemana(d.semana)}
                    </text>
                  </g>
                );
              })}

              {/* Tooltip dibujado en coordenadas del viewBox (no en % de pantalla): así
                  queda alineado con la barra sea cual sea el ancho/alto real de la card,
                  sin depender de que el aspect ratio del contenedor coincida con el del
                  viewBox (evita tener que estirar el SVG y deformar barras/texto). */}
              {hover !== null && data[hover] && (() => {
                const d = data[hover];
                const cx = hover * slot + slot / 2;
                const barTopY = PLOT_H - (d.cantidad / escalaMax) * PLOT_H;
                const texto = `${etiquetaSemana(d.semana)}: ${d.cantidad} reservas`;
                const anchoTexto = texto.length * 4.6 + 14;
                const tx = Math.min(Math.max(cx - anchoTexto / 2, 2), PLOT_W - anchoTexto - 2);
                const ty = Math.max(barTopY - 24, 2);
                return (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={tx} y={ty} width={anchoTexto} height={17} rx={4} className="fill-slate-900" />
                    <text
                      x={tx + anchoTexto / 2}
                      y={ty + 11.5}
                      textAnchor="middle"
                      className="fill-white text-[8px] font-medium"
                    >
                      {texto}
                    </text>
                  </g>
                );
              })()}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
