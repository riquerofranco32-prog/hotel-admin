"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { bootstrapFirstAdmin, getAdapter } from "@/lib/db";
import { fb, firebaseEnabled } from "@/lib/firebase";
import { makeActions, type Actions } from "@/lib/actions";
import { buildSeed } from "@/lib/seed";
import type { CollectionName, DataState, Staff } from "@/lib/types";
import { COLLECTIONS } from "@/lib/types";

const EMPTY: DataState = {
  rooms: [], guests: [], reservations: [], tasks: [], staff: [], charges: [], payments: [],
  invoices: [], menuItems: [], orders: [], templates: [], messages: [], activity: [], settings: [],
};

interface Ctx {
  mode: "firebase" | "demo";
  data: DataState;
  loaded: boolean;
  me: Staff | null;
  authReady: boolean;
  authEmail: string | null;
  accessError: boolean;
  actions: Actions;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, name: string): Promise<void>;
  demoLogin(staffId: string): void;
  logout(): Promise<void>;
  staffName(id?: string | null): string;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fuera de AppProvider");
  return c;
}

const DEMO_USER_KEY = "hotel-pms:demoUser";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const mode = firebaseEnabled ? "firebase" : "demo";
  const [data, setData] = useState<DataState>(EMPTY);
  const [loadedCols, setLoadedCols] = useState<Set<string>>(new Set());
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // ---- Auth ----
  useEffect(() => {
    if (mode === "firebase") {
      return onAuthStateChanged(fb().auth, (u) => {
        setFbUser(u);
        setAuthReady(true);
      });
    }
    try {
      setDemoUserId(localStorage.getItem(DEMO_USER_KEY));
    } catch {}
    setAuthReady(true);
  }, [mode]);

  const [bootstrapped, setBootstrapped] = useState(mode === "demo");
  const [accessError, setAccessError] = useState(false);

  // Firebase: si es el primer usuario del sistema, se crea como administrador
  useEffect(() => {
    if (mode !== "firebase") return;
    setBootstrapped(false);
    setAccessError(false);
    if (!fbUser?.email) return;
    bootstrapFirstAdmin(fbUser.email, pendingName || fbUser.displayName || fbUser.email.split("@")[0])
      .catch((e) => console.error("bootstrap", e))
      .finally(() => setBootstrapped(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fbUser]);

  const canRead = mode === "demo" || (!!fbUser && bootstrapped);

  // ---- Suscripciones en tiempo real ----
  useEffect(() => {
    if (!canRead) return;
    const db = getAdapter();
    const unsubs = COLLECTIONS.map((col) =>
      db.subscribe(col, (docs) => {
        setData((d) => ({ ...d, [col]: docs }));
        setLoadedCols((s) => (s.has(col) ? s : new Set(s).add(col)));
      }, () => {
        setAccessError(true);
        setLoadedCols((s) => (s.has(col) ? s : new Set(s).add(col)));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [canRead]);

  const loaded = loadedCols.size === COLLECTIONS.length;

  // ---- Modo demo: sembrar datos la primera vez ----
  useEffect(() => {
    if (mode !== "demo" || !loaded) return;
    if (data.rooms.length === 0 && data.staff.length === 0) {
      const seed = buildSeed();
      const db = getAdapter();
      COLLECTIONS.forEach((col) => db.bulkSet(col as CollectionName, seed[col] as never));
    }
  }, [mode, loaded, data.rooms.length, data.staff.length]);

  // ---- Usuario actual ----
  const me = useMemo<Staff | null>(() => {
    if (mode === "demo") return data.staff.find((s) => s.id === demoUserId && s.active) ?? null;
    if (!fbUser?.email) return null;
    const email = fbUser.email.toLowerCase();
    return data.staff.find((s) => (s.id === email || s.email.toLowerCase() === email) && s.active) ?? null;
  }, [mode, data.staff, demoUserId, fbUser]);

  const meRef = useRef(me);
  meRef.current = me;
  const actions = useMemo(() => makeActions(getAdapter(), () => dataRef.current, () => meRef.current), []);

  const staffName = useCallback(
    (id?: string | null) => {
      if (!id) return "—";
      if (id === "sistema") return "Sistema";
      return data.staff.find((s) => s.id === id)?.name ?? "Usuario eliminado";
    },
    [data.staff],
  );

  const value: Ctx = {
    mode,
    data,
    loaded,
    me,
    authReady,
    accessError,
    authEmail: mode === "firebase" ? fbUser?.email ?? null : me?.email ?? null,
    actions,
    async login(email, password) {
      await signInWithEmailAndPassword(fb().auth, email, password);
    },
    async register(email, password, name) {
      setPendingName(name);
      await createUserWithEmailAndPassword(fb().auth, email, password);
    },
    demoLogin(staffId) {
      try {
        localStorage.setItem(DEMO_USER_KEY, staffId);
      } catch {}
      setDemoUserId(staffId);
    },
    async logout() {
      if (mode === "firebase") {
        await signOut(fb().auth);
        setData(EMPTY);
        setLoadedCols(new Set());
      }
      try {
        localStorage.removeItem(DEMO_USER_KEY);
      } catch {}
      setDemoUserId(null);
    },
    staffName,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
