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
          ? "El email o la contraseña no son correctos. Revisalos y probá de nuevo."
          : code.includes("email-already-in-use")
            ? "Ese email ya tiene una cuenta. Tocá “Entrar” para ingresar."
            : code.includes("weak-password")
              ? "La contraseña tiene que tener 6 letras o números como mínimo."
              : "No se pudo entrar. Probá de nuevo. (" + code + ")",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
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
          <h1 className="display text-4xl leading-[1.1] xl:text-5xl">
            Todo el hotel,
            <br />
            en <span className="serif-accent">un solo lugar.</span>
          </h1>
          <ul className="space-y-3.5 text-base text-white/85">
            {[
              "Calendario de habitaciones con colores, siempre al día",
              "Cuando un huésped se va, las tareas de limpieza se crean solas",
              "Cada persona ve solo lo que necesita para su trabajo",
              "Facturas, cobros y ficha de cada huésped",
            ].map((x) => (
              <li key={x} className="flex items-start gap-3">
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-[14px] text-white/70">Panel para manejar el hotel</div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-4 py-8 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-6 shadow-card sm:p-8">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-btn">
              <BedDouble size={20} />
            </span>
            <span className="text-sm font-bold uppercase tracking-[0.2em]">{hotelName}</span>
          </div>
          <h2 className="display text-2xl sm:text-[28px]">{mode === "firebase" ? (isRegister ? "Crear mi cuenta" : "Entrar al panel") : "Elegí con quién entrar"}</h2>
          <p className="mb-6 mt-2 text-[15px] leading-relaxed text-gray-700">
            {mode === "firebase" ? "Escribí el email con el que te dieron de alta y tu contraseña." : "Es una prueba. Tocá tu nombre para entrar y ver cómo ve el panel cada cargo."}
          </p>

          {mode === "firebase" ? (
            <form onSubmit={submit} className="space-y-4">
              {isRegister && (
                <Field label="Nombre y apellido">
                  <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </Field>
              )}
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </Field>
              <Field label="Contraseña (6 letras o números como mínimo)">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </Field>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[15px] text-red-700">{error}</p>}
              <Button type="submit" variant="primary" className="h-12 w-full text-base" disabled={busy}>
                {busy ? "Entrando…" : isRegister ? "Crear mi cuenta" : "Entrar"}
              </Button>
              <p className="text-center text-[15px] text-gray-700">
                {isRegister ? "¿Ya tenés cuenta? " : "¿Es tu primera vez? "}
                <button type="button" className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline-offset-2 hover:underline" onClick={() => setIsRegister(!isRegister)}>
                  {isRegister ? "Tocá acá para entrar" : "Tocá acá para crear tu cuenta"}
                </button>
              </p>
              <p className="text-center text-[14px] text-gray-600">La primera persona que crea su cuenta queda como Administrador general.</p>
            </form>
          ) : !staffLoaded ? (
            <p className="text-[15px] text-gray-700">Cargando, esperá un momento…</p>
          ) : (
            <div className="space-y-5">
              {ALL_ROLES.map((role) => {
                const people = data.staff.filter((s) => s.active && normalizeRole(s.role) === role);
                if (!people.length) return null;
                return (
                  <div key={role}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cls("rounded-md px-2.5 py-1 text-[14px] font-semibold", ROLE_COLOR[role])}>{ROLE_LABEL[role]}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {people.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => demoLogin(s.id)}
                          className="flex min-h-14 items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-3 text-left transition hover:border-accent hover:bg-accent/5 hover:shadow-card active:scale-[0.99]"
                        >
                          <Avatar name={s.name} size={36} />
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-medium">{s.name}</span>
                            <span className="block truncate text-[13.5px] text-gray-600">{s.email}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="rounded-lg bg-blue-50 px-3 py-2.5 text-[14px] leading-snug text-blue-900">
                Esto es una prueba: lo que hagas se guarda solo en este navegador. Cuando el hotel use datos reales en internet, cada persona va a entrar con su email y su contraseña.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
