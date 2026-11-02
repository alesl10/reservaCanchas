import { LuTrendingUp, LuTrendingDown, LuMinus } from "react-icons/lu";
import type { ReservasPorSemana } from "@/types";

export function StatTileReservas({
  totalActual,
  variacionPorcentual,
  porSemana,
}: {
  totalActual: number;
  variacionPorcentual: number;
  porSemana: ReservasPorSemana[];
}) {
  const positivo = variacionPorcentual > 0;
  const negativo = variacionPorcentual < 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0">
        <p className="text-[11.5px] text-slate-400 font-medium mb-1.5">Reservas esta semana</p>
        <p className="text-[34px] font-extrabold text-slate-900 leading-none tracking-tight">{totalActual}</p>
      </div>

      <div className="flex-1 min-h-[36px] mt-2">
        <Sparkline data={porSemana} />
      </div>

      <div className="flex-shrink-0 mt-1">
        <span
          className={`inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-full ${
            positivo ? "bg-emerald-50 text-emerald-700" : negativo ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {positivo ? <LuTrendingUp size={12} /> : negativo ? <LuTrendingDown size={12} /> : <LuMinus size={12} />}
          {positivo ? "+" : ""}
          {variacionPorcentual}% vs. semana anterior
        </span>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: ReservasPorSemana[] }) {
  if (data.length < 2) return null;

  const W = 100;
  const H = 40;
  const PAD = 4;
  const valores = data.map((d) => d.cantidad);
  const min = Math.min(...valores);
  const max = Math.max(...valores, min + 1);

  const puntos = data.map((d, i) => {
    const x = PAD + (i * (W - PAD * 2)) / (data.length - 1);
    const y = H - PAD - ((d.cantidad - min) / (max - min)) * (H - PAD * 2);
    return { x, y };
  });

  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${linea} L${puntos[puntos.length - 1].x},${H} L${puntos[0].x},${H} Z`;
  const ultimo = puntos[puntos.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      role="presentation"
      aria-hidden="true"
    >
      <path d={area} className="fill-brand-500" opacity={0.1} />
      <path
        d={linea}
        fill="none"
        className="stroke-slate-300"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={ultimo.x} cy={ultimo.y} r={2.5} className="fill-brand-700" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
