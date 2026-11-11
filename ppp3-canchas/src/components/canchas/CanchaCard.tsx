import { useNavigate } from "react-router-dom";
import type { Cancha } from "@/types";
import { MoneyUtils } from "@/utils";
import { BadgeCancha } from "@/components/atoms";
import { CAPACITY_LABEL, CAPACITY_COLOR } from "@/mock";
import { LuUsers, LuDollarSign, LuPencil, LuArrowRight, LuTrash2 } from "react-icons/lu";

interface Props {
  cancha: Cancha;
  mode?: "public" | "admin";
  onCambiarEstado?: (cancha: Cancha) => void;
  onEditar?: (cancha: Cancha) => void;
  onEliminar?: (cancha: Cancha) => void;
}

export function CanchaCard({
  cancha,
  mode = "public",
  onCambiarEstado,
  onEditar,
  onEliminar,
}: Props) {
  const navigate = useNavigate();
  const gradientClass =
    CAPACITY_COLOR[cancha.capacidad] ?? "from-brand-900 to-brand-700";

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden transition-all duration-200 hover:-translate-y-1 flex flex-col group"
      style={{ boxShadow: "var(--shadow-card)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-card-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-card)")
      }
    >
      <div
        className={`bg-gradient-to-br ${gradientClass} px-5 py-5 relative overflow-hidden`}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative flex justify-between items-start">
          <div>
            <h3 className="text-white font-bold text-[16px] leading-tight mb-1">
              {cancha.nombre}
            </h3>
            <p className="text-white/70 text-xs font-medium">
              {CAPACITY_LABEL[cancha.capacidad] ?? "Cancha"}
            </p>
          </div>
          <BadgeCancha estado={cancha.estado} />
        </div>
      </div>
      <div className="px-5 py-4 flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-500 flex-1">
            <LuUsers size={15} className="text-slate-400 flex-shrink-0" />
            <span>
              {CAPACITY_LABEL[cancha.capacidad] ?? "—"} · {cancha.capacidad}{" "}
              jugadores
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <LuDollarSign size={15} className="text-brand-600 flex-shrink-0" />
          <span className="text-[22px] font-extrabold text-brand-700 tracking-tight leading-none">
            {MoneyUtils.formatear(cancha.precioPorHora)}
          </span>
          <span className="text-sm text-slate-400 font-medium self-end pb-0.5">
            /hora
          </span>
        </div>
        {cancha.descripcion && (
          <p className="text-[13px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
            {cancha.descripcion}
          </p>
        )}
      </div>
      <div className="px-5 pb-5">
        {mode === "public" ? (
          <button
            className="btn btn-primary btn-block group-hover:bg-brand-800 transition-colors"
            onClick={() => navigate(`/reservar?cancha=${cancha.id}`)}
          >
            Reservar Ahora
            <LuArrowRight size={15} />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="btn btn-outline flex-1 text-[13px]"
              onClick={() => onEditar?.(cancha)}
            >
              <LuPencil size={14} />
              Editar
            </button>
            <button
              className="btn btn-outline flex-1 text-[13px]"
              onClick={() => onCambiarEstado?.(cancha)}
            >
              Estado
            </button>
            <button
              className="btn btn-outline text-[13px] text-red-600 hover:bg-red-50 hover:border-red-300"
              onClick={() => onEliminar?.(cancha)}
              title="Eliminar cancha"
              aria-label="Eliminar cancha"
            >
              <LuTrash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
