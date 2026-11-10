"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CheckCircle2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Avatar, Button, Field, Input } from "@/components/ui";
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
    <div className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1fr_1.1fr]">
      <div aria-hidden className="gate-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="gate-glow-big pointer-events-none absolute inset-0 hidden lg:block" />
      <div aria-hidden className="gate-grid pointer-events-none absolute inset-0" />
      {/* Panel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-fg lg:flex">
        <LighthouseScene />
        <Wave className="absolute inset-x-0 bottom-0 h-48" />
        <div className="relative flex items-center gap-2.5">
          <span className="logo-grad flex h-11 w-11 items-center justify-center rounded-xl text-accent-fg">
            <BedDouble size={20} />
          </span>
          <span className="display text-sm">{hotelName}</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="display text-4xl leading-[1.1] xl:text-6xl">
            Todo el hotel,
            <br />
            en <span className="serif-accent">un solo lugar.</span>
          </h1>
          <ul className="stagger space-y-3.5 text-base text-gray-800">
            {[
              "Calendario de habitaciones con colores, siempre al día",
              "Cuando un huésped se va, las tareas de limpieza se crean solas",
              "Cada persona ve solo lo que necesita para su trabajo",
              "Facturas, cobros y ficha de cada huésped",
            ].map((x) => (
              <li key={x} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <CheckCircle2 size={18} className="text-accent" />
                </span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="label-mono relative text-[12.5px] text-gray-600">Panel para manejar el hotel</div>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center px-4 py-8 sm:p-8">
        <div className="ui-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/80 bg-panel p-6 shadow-pop before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-accent before:to-transparent sm:p-8">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="logo-grad flex h-10 w-10 items-center justify-center rounded-xl text-accent-fg">
              <BedDouble size={20} />
            </span>
            <span className="display text-sm">{hotelName}</span>
          </div>
          <h2 className="display text-[26px] sm:text-[30px]">{mode === "firebase" ? (isRegister ? "Crear mi cuenta" : "Entrar al panel") : "Elegí con quién entrar"}</h2>
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
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </Field>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[15px] text-red-700">{error}</p>}
              <Button type="submit" variant="primary" className="h-12 w-full text-base" disabled={busy}>
                {busy ? "Entrando…" : isRegister ? "Crear mi cuenta" : "Entrar"}
              </Button>
              <p className="text-center text-[15px] text-gray-700">
                {isRegister ? "¿Ya tenés cuenta? " : "¿Es tu primera vez? "}
                <button type="button" className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-2 hover:underline" onClick={() => setIsRegister(!isRegister)}>
                  {isRegister ? "Tocá acá para entrar" : "Tocá acá para crear tu cuenta"}
                </button>
              </p>
              <p className="text-center text-[14px] text-gray-600">La primera persona que crea su cuenta queda como Administrador general.</p>
            </form>
          ) : !staffLoaded ? (
            <p className="text-[15px] text-gray-700">Cargando, esperá un momento…</p>
          ) : (
            <div className="stagger space-y-5">
              {ALL_ROLES.map((role) => {
                const people = data.staff.filter((s) => s.active && normalizeRole(s.role) === role);
                if (!people.length) return null;
                return (
                  <div key={role}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cls("label-mono rounded-md px-2.5 py-1 text-[12.5px] font-semibold tracking-wider", ROLE_COLOR[role])}>{ROLE_LABEL[role]}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {people.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => demoLogin(s.id)}
                          className="lift flex min-h-14 items-center gap-3 rounded-xl border border-gray-300 bg-[rgb(var(--well))] px-3 py-3 text-left hover:bg-accent/5"
                        >
                          <Avatar name={s.name} size={36} />
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-medium text-fg">{s.name}</span>
                            <span className="block truncate text-[13.5px] text-gray-600">{s.email}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="rounded-lg border border-gray-200 bg-panel-2 px-3 py-2.5 text-[14px] leading-snug text-gray-700">
                Esto es una prueba: lo que hagas se guarda solo en este navegador. Cuando el hotel use datos reales en internet, cada persona va a entrar con su email y su contraseña.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
