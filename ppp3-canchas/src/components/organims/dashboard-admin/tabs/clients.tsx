import { useState } from "react";
import { useClientes, useDebounce } from "@/hooks";
import { ClientesService } from "@/services";
import { ClientsTable } from "@/components/organims/tables";
import { Modal, useAlert } from "@/components";
import { FieldError, inputCls, Select, SelectItem } from "@/components/atoms";
import { TIPOS_CLIENTE } from "@/mock";
import type { Cliente, EstadoCliente } from "@/types";

interface FormCliente {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  tipoClienteId: string;
  estado: EstadoCliente;
}

type FormErrors = { nombre: string; apellido: string; telefono: string };

const FORM_VACIO: FormCliente = {
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  tipoClienteId: "",
  estado: "activo",
};

const ERRORS_VACIO: FormErrors = { nombre: "", apellido: "", telefono: "" };

export function ClientesTab() {
  const [busqueda, setBusqueda] = useState("");
  const termino = useDebounce(busqueda, 500);
  const params: Record<string, string> = termino ? { busqueda: termino } : {};
  const { clientes, loading, error, recargar } = useClientes(params);
  const { mostrar, AlertComponent } = useAlert();

  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormCliente>(FORM_VACIO);
  const [formErrors, setFormErrors] = useState<FormErrors>(ERRORS_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null);
  const [eliminando, setEliminando] = useState(false);

  function abrirEdicion(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      email: cliente.email ?? "",
      tipoClienteId: cliente.tipoClienteId != null ? String(cliente.tipoClienteId) : "",
      estado: cliente.estado ?? "activo",
    });
    setFormErrors(ERRORS_VACIO);
  }

  async function guardarCliente() {
    if (!editando) return;
    const errs = { ...ERRORS_VACIO };
    if (!form.nombre.trim()) errs.nombre = "El nombre es obligatorio";
    if (!form.apellido.trim()) errs.apellido = "El apellido es obligatorio";
    if (!/^\d{8,15}$/.test(form.telefono.trim()))
      errs.telefono = "Teléfono inválido (8 a 15 dígitos)";
    if (errs.nombre || errs.apellido || errs.telefono) {
      setFormErrors(errs);
      return;
    }

    setGuardando(true);
    setFormErrors(ERRORS_VACIO);
    try {
      await ClientesService.actualizar(editando.id, {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim() || undefined,
        tipoClienteId: form.tipoClienteId ? Number(form.tipoClienteId) : undefined,
      });
      if (form.estado !== (editando.estado ?? "activo")) {
        await ClientesService.cambiarEstado(editando.id, form.estado);
      }
      mostrar("Cliente actualizado", "success");
      setEditando(null);
      recargar();
    } catch (err) {
      mostrar((err as Error).message || "Error al guardar", "error");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCliente() {
    if (!confirmDelete) return;
    setEliminando(true);
    try {
      await ClientesService.eliminar(confirmDelete.id);
      mostrar("Cliente eliminado", "success");
      setConfirmDelete(null);
      recargar();
    } catch (err) {
      mostrar((err as Error).message || "Error al eliminar el cliente", "error");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div>
      {AlertComponent}
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-6">
        Gestión de Clientes
      </h1>
      <div className="mb-6 max-w-sm">
        <input
          type="text"
          className="form-input"
          placeholder="Buscar por nombre, teléfono o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      {error && (
        <div className="px-4 py-3.5 rounded-xl flex items-start gap-3 text-[13.5px] border bg-red-50 text-red-800 border-red-200 mb-4">
          {error}
        </div>
      )}
      <ClientsTable
        clientes={clientes}
        loading={loading}
        error={error ?? ""}
        onEditar={abrirEdicion}
        onEliminar={setConfirmDelete}
      />

      {editando && (
        <Modal
          titulo={`Editar — ${editando.nombre} ${editando.apellido}`}
          onClose={() => setEditando(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardarCliente} disabled={guardando}>
                {guardando ? "Guardando" : "Guardar"}
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-4 mb-1">
            <div className="mb-4">
              <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
                Nombre
              </label>
              <input
                className={inputCls(formErrors.nombre)}
                value={form.nombre}
                onChange={(e) => {
                  setForm({ ...form, nombre: e.target.value });
                  setFormErrors((v) => ({ ...v, nombre: "" }));
                }}
              />
              <FieldError msg={formErrors.nombre} />
            </div>
            <div className="mb-4">
              <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
                Apellido
              </label>
              <input
                className={inputCls(formErrors.apellido)}
                value={form.apellido}
                onChange={(e) => {
                  setForm({ ...form, apellido: e.target.value });
                  setFormErrors((v) => ({ ...v, apellido: "" }));
                }}
              />
              <FieldError msg={formErrors.apellido} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
              Teléfono
            </label>
            <input
              className={inputCls(formErrors.telefono)}
              value={form.telefono}
              onChange={(e) => {
                setForm({ ...form, telefono: e.target.value });
                setFormErrors((v) => ({ ...v, telefono: "" }));
              }}
            />
            <FieldError msg={formErrors.telefono} />
          </div>
          <div className="mb-4">
            <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
              Email <span className="text-slate-400 font-normal text-[12px]">(opcional)</span>
            </label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="mb-1">
              <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
                Tipo de cliente
              </label>
              <Select
                value={form.tipoClienteId}
                onValueChange={(v) => setForm({ ...form, tipoClienteId: v })}
                placeholder="Seleccionar tipo"
              >
                {TIPOS_CLIENTE.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre} ({t.descuento}%)
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="mb-1">
              <label className="block mb-1.5 text-[13px] font-semibold text-slate-800 tracking-[0.01em]">
                Estado
              </label>
              <Select
                value={form.estado}
                onValueChange={(v) => setForm({ ...form, estado: v as EstadoCliente })}
              >
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </Select>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          titulo="Eliminar cliente"
          onClose={() => setConfirmDelete(null)}
          footer={
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                onClick={eliminarCliente}
                disabled={eliminando}
              >
                {eliminando ? "Eliminando" : "Eliminar"}
              </button>
            </div>
          }
        >
          <p className="text-slate-600">
            ¿Querés eliminar a{" "}
            <strong>
              {confirmDelete.nombre} {confirmDelete.apellido}
            </strong>
            ? Esta acción no se puede deshacer: también se cancelarán y eliminarán todas sus reservas (incluidas las pendientes) y su cuenta de acceso.
          </p>
        </Modal>
      )}
    </div>
  );
}
