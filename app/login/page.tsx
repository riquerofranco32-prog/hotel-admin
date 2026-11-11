"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BedDouble, CheckCircle2, ChevronRight } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Avatar, Button, Field, Input, Skeleton } from "@/components/ui";
import { Wave } from "@/components/viz";
import { ALL_ROLES, cls, normalizeRole, ROLE_COLOR, ROLE_LABEL } from "@/lib/logic";

/** Escena ambiental del panel de marca: faro, olas, estrellas y luna en oscuro; sol y nubes en claro. Muy lenta y sin texto. */
function LighthouseScene() {
  const stars: [number, number, number][] = [[40, 60, 0], [120, 30, 1.2], [200, 90, 2.1], [330, 50, 0.6], [370, 150, 1.8], [70, 170, 2.8], [260, 20, 3.3]];
  return (
    <svg aria-hidden viewBox="0 0 400 500" className="pointer-events-none absolute bottom-0 right-0 h-[88%] max-w-[62%] overflow-visible opacity-90">
      <defs>
        <linearGradient id="lh-beam-l" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="rgb(251 191 36)" stopOpacity="0.5" />
          <stop offset="1" stopColor="rgb(251 191 36)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lh-beam-r" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgb(251 191 36)" stopOpacity="0.5" />
          <stop offset="1" stopColor="rgb(251 191 36)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="lh-tower">
          <polygon points="214,440 250,440 244,262 220,262" />
        </clipPath>
      </defs>
      {/* Cielo de noche (oscuro) */}
      <g className="hidden dark:block">
        <circle cx="310" cy="110" r="22" fill="rgb(var(--fg))" fillOpacity="0.55" />
        {stars.map(([x, y, d]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="rgb(var(--fg))" className="ui-twinkle" style={{ animationDelay: `${d}s` }} />
        ))}
      </g>
      {/* Cielo de día (claro) */}
      <g className="dark:hidden">
        <circle cx="310" cy="110" r="52" fill="rgb(251 191 36)" fillOpacity="0.18" />
        <circle cx="310" cy="110" r="30" fill="rgb(251 191 36)" fillOpacity="0.55" />
        <g className="ui-cloud" fill="rgb(255 255 255)" fillOpacity="0.8">
          <ellipse cx="90" cy="120" rx="46" ry="13" />
          <ellipse cx="116" cy="108" rx="28" ry="14" />
        </g>
        <g className="ui-cloud" style={{ animationDelay: "-9s" }} fill="rgb(255 255 255)" fillOpacity="0.65">
          <ellipse cx="230" cy="190" rx="38" ry="10" />
          <ellipse cx="250" cy="181" rx="22" ry="11" />
        </g>
      </g>
      {/* Haces de luz */}
      <g className="ui-beam">
        <polygon points="232,242 -70,196 -70,288" fill="url(#lh-beam-l)" />
        <polygon points="232,242 470,204 470,280" fill="url(#lh-beam-r)" />
      </g>
      {/* Isla y faro */}
      <ellipse cx="232" cy="450" rx="78" ry="18" fill="rgb(var(--fg))" fillOpacity="0.3" />
      <polygon points="214,440 250,440 244,262 220,262" fill="rgb(var(--accent))" fillOpacity="0.9" />
      <g clipPath="url(#lh-tower)" fill="rgb(var(--panel))" fillOpacity="0.9">
        <rect x="200" y="300" width="70" height="30" />
        <rect x="200" y="372" width="70" height="30" />
      </g>
      <rect x="212" y="252" width="40" height="10" rx="2" fill="rgb(var(--fg))" fillOpacity="0.7" />
      <rect x="220" y="230" width="24" height="22" rx="3" fill="rgb(251 191 36)" />
      <polygon points="215,230 249,230 232,212" fill="rgb(var(--accent-hover))" />
    </svg>
  );
}

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
    <div className="relative grid min-h-[100dvh] overflow-hidden lg:grid-cols-[1fr_1.1fr]">
      <div aria-hidden className="gate-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="gate-glow-big pointer-events-none absolute inset-0 hidden lg:block" />
      <div aria-hidden className="gate-grid pointer-events-none absolute inset-0" />
      {/* Panel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-fg lg:flex xl:p-14">
        <LighthouseScene />
        <Wave className="absolute inset-x-0 bottom-0 h-48" />
        <div className="relative flex items-center gap-2.5">
          <span className="logo-grad flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-accent-fg">
            <BedDouble size={20} aria-hidden />
          </span>
          <span className="display truncate text-sm">{hotelName}</span>
        </div>
        <div className="relative max-w-xl space-y-7">
          <h1 className="display text-balance text-4xl leading-[1.1] xl:text-[56px]">
            Todo el hotel,
            <br />
            en <span className="serif-accent">un solo lugar.</span>
          </h1>
          <ul className="stagger space-y-3 text-[15.5px] leading-snug text-gray-800">
            {[
              "Calendario de habitaciones con colores, siempre al día",
              "Cuando un huésped se va, las tareas de limpieza se crean solas",
              "Cada persona ve solo lo que necesita para su trabajo",
              "Facturas, cobros y ficha de cada huésped",
            ].map((x) => (
              <li key={x} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/15">
                  <CheckCircle2 size={17} className="text-accent" aria-hidden />
                </span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="label-mono relative text-[12.5px] text-gray-600">Panel para manejar el hotel</div>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center px-4 py-8 sm:p-8 lg:border-l lg:border-gray-200/60 lg:bg-panel/40 lg:backdrop-blur-[2px]">
        <div className="ui-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/80 bg-panel p-6 shadow-pop before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-accent before:to-transparent sm:p-8">
          <div className="mb-6 flex items-center gap-2.5 border-b border-gray-200/70 pb-5 lg:hidden">
            <span className="logo-grad flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-accent-fg">
              <BedDouble size={20} aria-hidden />
            </span>
            <span className="display min-w-0 truncate text-sm">{hotelName}</span>
          </div>
          <h2 className="display text-balance text-[24px] text-fg sm:text-[28px]">{mode === "firebase" ? (isRegister ? "Crear mi cuenta" : "Entrar al panel") : "Elegí con quién entrar"}</h2>
          <p className="mb-6 mt-2 text-[15px] leading-relaxed text-gray-600">
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
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={isRegister ? "new-password" : "current-password"} />
              </Field>
              {error && (
                <p role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[14.5px] leading-snug text-red-700">
                  <AlertCircle size={18} className="mt-px shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{error}</span>
                </p>
              )}
              <Button type="submit" variant="primary" className="h-12 w-full text-base sm:h-12" disabled={busy}>
                {busy ? "Entrando…" : isRegister ? "Crear mi cuenta" : "Entrar"}
              </Button>
              <p className="border-t border-gray-200/70 pt-3 text-center text-[15px] text-gray-700">
                {isRegister ? "¿Ya tenés cuenta? " : "¿Es tu primera vez? "}
                <button type="button" className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-2 hover:underline" onClick={() => setIsRegister(!isRegister)}>
                  {isRegister ? "Tocá acá para entrar" : "Tocá acá para crear tu cuenta"}
                </button>
              </p>
              <p className="text-balance text-center text-[13.5px] leading-snug text-gray-600">La primera persona que crea su cuenta queda como Administrador general.</p>
            </form>
          ) : !staffLoaded ? (
            <div role="status" className="space-y-3">
              <p className="text-[15px] text-gray-600">Cargando, esperá un momento…</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <div className="stagger space-y-5">
              {ALL_ROLES.map((role) => {
                const people = data.staff.filter((s) => s.active && normalizeRole(s.role) === role);
                if (!people.length) return null;
                return (
                  <div key={role}>
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className={cls("label-mono rounded-md px-2 py-0.5 text-[11.5px] font-medium", ROLE_COLOR[role])}>{ROLE_LABEL[role]}</span>
                      <span aria-hidden className="h-px flex-1 bg-gray-200/80" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {people.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => demoLogin(s.id)}
                          className="group flex min-h-14 items-center gap-3 rounded-xl border border-gray-200 bg-[rgb(var(--well))] px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent/50 hover:bg-accent/[0.06] motion-reduce:transition-none"
                        >
                          <Avatar name={s.name} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-fg">{s.name}</span>
                            <span className="block truncate text-[13px] text-gray-600">{s.email}</span>
                          </span>
                          <ChevronRight size={16} aria-hidden className="shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transition-none" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="rounded-lg border border-gray-200 bg-panel-2 px-3.5 py-3 text-[13.5px] leading-relaxed text-gray-600">
                Esto es una prueba: lo que hagas se guarda solo en este navegador. Cuando el hotel use datos reales en internet, cada persona va a entrar con su email y su contraseña.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
