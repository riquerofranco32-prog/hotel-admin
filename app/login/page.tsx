"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Button, Field, Input } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/logic";

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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold uppercase tracking-[0.25em]">{hotelName}</div>
          <div className="mt-1 text-sm text-gray-500">Panel de administración</div>
        </div>

        {mode === "firebase" ? (
          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <Field label="Nombre y apellido">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Contraseña">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? "Ingresando…" : isRegister ? "Crear cuenta" : "Ingresar"}
            </Button>
            <p className="text-center text-xs text-gray-500">
              {isRegister ? "¿Ya tenés cuenta? " : "¿Primera vez? "}
              <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? "Iniciar sesión" : "Crear cuenta"}
              </button>
              <br />
              El primer usuario que se registra queda como administrador. Los demás deben ser dados de alta por un administrador.
            </p>
          </form>
        ) : (
          <div>
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <b>Modo demo:</b> los datos se guardan en este navegador. Configurá las variables de Firebase para usar la base real
              multiusuario. Elegí con qué usuario entrar para probar los distintos roles:
            </p>
            {!loaded ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : (
              <div className="space-y-2">
                {data.staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => demoLogin(s.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-gray-900 hover:bg-gray-50"
                    >
                      <span>
                        <span className="block text-sm font-medium">{s.name}</span>
                        <span className="block text-xs text-gray-500">{s.email}</span>
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{ROLE_LABEL[s.role]}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
