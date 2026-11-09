"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CheckCircle2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Avatar, Button, Field, Input } from "@/components/ui";
import { ALL_ROLES, cls, normalizeRole, ROLE_COLOR, ROLE_LABEL } from "@/lib/logic";

export default function LoginPage() {
  const { mode, data, loaded, me, authEmail, demoLogin, login, register } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hotelName = data.settings[0]?.hotelName ?? "Hotel Al Mare";
  const staffLoaded = loaded || data.staff.length > 0;

  useEffect(() => {
    if (mode === "demo" && me) router.replace("/");
    if (mode === "firebase" && authEmail) router.replace("/");
  }, [mode, me, authEmail, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(email.trim(), password, name.trim());
      else await login(email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password")
          ? "Email o contraseña incorrectos"
          : code.includes("email-already-in-use")
            ? "Ese email ya tiene cuenta. Iniciá sesión."
            : code.includes("weak-password")
              ? "La contraseña debe tener al menos 6 caracteres"
              : "No se pudo ingresar: " + code,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.1fr]">
      {/* Panel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b1218] p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-[#04201c] shadow-btn">
            <BedDouble size={20} />
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.22em]">{hotelName}</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="display text-4xl">
            Todo el hotel,
            <br />
            en <span className="serif-accent">un solo lugar.</span>
          </h1>
          <ul className="space-y-3 text-[15px] text-gray-300">
            {[
              "Calendario de ocupación por colores, en tiempo real",
              "Housekeeping automático: el check-out genera las tareas solo",
              "Cada cargo ve sólo lo que necesita",
              "Facturación, finanzas y CRM de huéspedes",
            ].map((x) => (
              <li key={x} className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-400" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-gray-500">Panel de administración hotelera</div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="text-lg font-bold uppercase tracking-[0.25em]">{hotelName}</div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{mode === "firebase" ? (isRegister ? "Crear cuenta" : "Iniciar sesión") : "Elegí con quién entrar"}</h2>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            {mode === "firebase" ? "Ingresá con el email que te dio de alta el administrador." : "Modo demo: probá cómo ve el panel cada cargo del hotel."}
          </p>

          {mode === "firebase" ? (
            <form onSubmit={submit} className="space-y-4">
              {isRegister && (
                <Field label="Nombre y apellido">
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
              )}
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-11" />
              </Field>
              <Field label="Contraseña">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
              </Field>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" variant="primary" className="h-11 w-full" disabled={busy}>
                {busy ? "Ingresando…" : isRegister ? "Crear cuenta" : "Ingresar"}
              </Button>
              <p className="text-center text-sm text-gray-500">
                {isRegister ? "¿Ya tenés cuenta? " : "¿Primera vez? "}
                <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => setIsRegister(!isRegister)}>
                  {isRegister ? "Iniciar sesión" : "Crear cuenta"}
                </button>
              </p>
              <p className="text-center text-xs text-gray-400">El primer usuario que se registra queda como Administrador general.</p>
            </form>
          ) : !staffLoaded ? (
            <p className="text-sm text-gray-500">Cargando…</p>
          ) : (
            <div className="space-y-4">
              {ALL_ROLES.map((role) => {
                const people = data.staff.filter((s) => s.active && normalizeRole(s.role) === role);
                if (!people.length) return null;
                return (
                  <div key={role}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={cls("rounded px-1.5 py-0.5 text-[11px] font-semibold", ROLE_COLOR[role])}>{ROLE_LABEL[role]}</span>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {people.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => demoLogin(s.id)}
                          className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2 text-left transition hover:border-gray-900 hover:bg-gray-50"
                        >
                          <Avatar name={s.name} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{s.name}</span>
                            <span className="block truncate text-xs text-gray-500">{s.email}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Los datos de la demo se guardan en este navegador. Con las variables de Firebase configuradas, el panel pasa a ser multiusuario y en tiempo real.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
