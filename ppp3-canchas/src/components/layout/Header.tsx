import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context";
import { Modal } from "@/components/atoms";
import { EditarPerfilModal } from "./EditarPerfilModal";
import { LuAlignJustify, LuCalendar, LuLogOut, LuUserRound, LuChartBarIncreasing, LuMenu, LuX, LuPencil } from "react-icons/lu";

function NavLink({
  to,
  active,
  icon,
  label,
  onClick,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-lg transition-all duration-150
        ${active ? "bg-white/15 text-white font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Header() {
  const { sesion, logout, isAdmin, isCliente } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [perfilModal, setPerfilModal] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function confirmarLogout() {
    navigate("/", { replace: true });
    logout();
    setLogoutModal(false);
  }

  const isActive = (p: string) => pathname === p;

  const clienteLinks = (
    <>
      <NavLink
        to="/"
        active={isActive("/")}
        icon={<LuAlignJustify size={15} />}
        label="Inicio"
        onClick={() => setMobileOpen(false)}
      />
      <NavLink
        to="/reservar"
        active={isActive("/reservar")}
        icon={<LuCalendar size={15} />}
        label="Reservar"
        onClick={() => setMobileOpen(false)}
      />
      <NavLink
        to="/mis-reservas"
        active={isActive("/mis-reservas")}
        icon={<LuCalendar size={15} />}
        label="Mis Reservas"
        onClick={() => setMobileOpen(false)}
      />
    </>
  );

  const adminLinks = (
    <>
      <NavLink
        to="/admin"
        active={isActive("/admin")}
        icon={<LuChartBarIncreasing size={15} />}
        label="Panel Admin"
        onClick={() => setMobileOpen(false)}
      />
    </>
  );

  const publicLinks = (
    <>
      <NavLink
        to="/"
        active={isActive("/")}
        icon={<LuAlignJustify size={15} />}
        label="Inicio"
        onClick={() => setMobileOpen(false)}
      />
      <NavLink
        to="/reservar"
        active={isActive("/reservar")}
        icon={<LuCalendar size={15} />}
        label="Reservar"
        onClick={() => setMobileOpen(false)}
      />
    </>
  );

  const navLinks = isAdmin ? adminLinks : isCliente ? clienteLinks : publicLinks;

  const sessionBlock = sesion ? (
    <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/15">
      {isCliente ? (
        <button
          onClick={() => setPerfilModal(true)}
          title="Editar mis datos"
          className="hidden lg:flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl hover:bg-white/20 transition-all cursor-pointer font-[inherit] group"
        >
          <LuUserRound size={14} className="text-emerald-300" />
          <span className="text-white text-[13px] font-medium">
            {sesion.nombre}
          </span>
          <LuPencil size={12} className="text-white/50 group-hover:text-white/80 transition-colors" />
        </button>
      ) : (
        <div className="hidden lg:flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl">
          <LuUserRound size={14} className="text-emerald-300" />
          <span className="text-white text-[13px] font-medium">
            {sesion.nombre}
          </span>
        </div>
      )}
      <button
        onClick={() => setLogoutModal(true)}
        className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 text-red-300 px-3 py-1.5 rounded-xl text-[13px] font-semibold hover:bg-red-500/30 hover:text-red-200 transition-all cursor-pointer font-[inherit]"
      >
        <LuLogOut size={14} /> Salir
      </button>
    </div>
  ) : (
    <Link
      to="/login"
      className="btn btn-white !py-1.5 !px-4 !text-[13px] !rounded-xl ml-2"
    >
      Ingresar
    </Link>
  );

  return (
    <>
    <header
      className="sticky top-0 z-50"
      style={{
        background:
          "linear-gradient(135deg,#022c22 0%,#064e3b 50%,#065f46 100%)",
      }}
    >
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      <div className="w-full px-4 sm:px-8 h-16 flex justify-between items-center">
        <Link
          to={sesion ? (isAdmin ? "/admin" : "/") : "/"}
          className="flex items-center gap-2.5 group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
            <span className="text-base leading-none">⚽</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white font-extrabold text-[15px] tracking-tight">
              FutbolReservas
            </span>
            <span className="text-emerald-400/70 text-[10px] font-medium tracking-wide hidden sm:block">
              Sistema de Reservas
            </span>
          </div>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-0.5"
        >
          {navLinks}
          {sessionBlock}
        </nav>

        <div className="flex md:hidden items-center gap-2">
          {!sesion ? (
            <Link
              to="/login"
              className="btn btn-white !py-1.5 !px-4 !text-[13px] !rounded-xl"
            >
              Ingresar
            </Link>
          ) : (
            <>
              <span className="text-white/80 text-[12px] font-medium">
                {sesion.nombre}
              </span>
              <button
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Menú"
              >
                {mobileOpen ? <LuX size={22} /> : <LuMenu size={22} />}
              </button>
            </>
          )}
        </div>
      </div>

      {mobileOpen && sesion && (
        <div
          className="md:hidden border-t border-white/10 px-4 py-4 flex flex-col gap-1"
          style={{
            background: "linear-gradient(135deg,#022c22 0%,#064e3b 100%)",
          }}
        >
          {navLinks}
          <div className="border-t border-white/10 mt-2 pt-3 flex flex-col gap-2">
            {isCliente && (
              <button
                onClick={() => { setMobileOpen(false); setPerfilModal(true); }}
                className="flex w-full items-center gap-2 bg-white/10 border border-white/15 text-white px-3 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer font-[inherit]"
              >
                <LuPencil size={15} /> Editar mis datos
              </button>
            )}
            <button
              onClick={() => { setMobileOpen(false); setLogoutModal(true); }}
              className="flex w-full items-center gap-2 bg-red-500/20 border border-red-400/30 text-red-300 px-3 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer font-[inherit]"
            >
              <LuLogOut size={15} /> Cerrar Sesión ({sesion.nombre})
            </button>
          </div>
        </div>
      )}
    </header>

    {logoutModal && (
      <Modal
        titulo="Cerrar sesión"
        onClose={() => setLogoutModal(false)}
        footer={
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={() => setLogoutModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={confirmarLogout}>
              <LuLogOut size={14} /> Cerrar sesión
            </button>
          </div>
        }
      >
        <p className="text-[14px] text-slate-600">
          ¿Estás seguro que deseás cerrar la sesión?
        </p>
      </Modal>
    )}

    {perfilModal && <EditarPerfilModal onClose={() => setPerfilModal(false)} />}
    </>
  );
}
