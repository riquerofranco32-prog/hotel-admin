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
import { today } from "@/lib/dates";
import { normalizeRole, permsFor, ROLE_COLLECTIONS, roomState } from "@/lib/logic";
import type { Charge, CollectionName, DataState, Guest, Payment, Perm, Reservation, Room, RoomState, Staff, Task } from "@/lib/types";
import { COLLECTIONS } from "@/lib/types";

const EMPTY: DataState = {
  rooms: [], guests: [], reservations: [], tasks: [], staff: [], charges: [], payments: [],
  invoices: [], menuItems: [], orders: [], templates: [], messages: [], activity: [], settings: [],
};

/** Índices precalculados: evitan recorrer listas completas en cada render (clave para la fluidez). */
export interface Indexes {
  roomById: Map<string, Room>;
  guestById: Map<string, Guest>;
  staffById: Map<string, Staff>;
  resById: Map<string, Reservation>;
  resByRoom: Map<string, Reservation[]>;
  resByGuest: Map<string, Reservation[]>;
  chargesByRes: Map<string, Charge[]>;
  paymentsByRes: Map<string, Payment[]>;
  openTasksByRoom: Map<string, Task[]>;
  roomStates: Map<string, RoomState>;
  roomsSorted: Room[];
}

interface Ctx {
  mode: "firebase" | "demo";
  data: DataState;
  idx: Indexes;
  loaded: boolean;
  me: Staff | null;
  perms: Perm[];
  can(p: Perm): boolean;
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
const BASE: CollectionName[] = ["staff", "settings"];

function group<T>(list: T[], key: (x: T) => string | undefined) {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (!k) continue;
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const mode = firebaseEnabled ? "firebase" : "demo";
  const [data, setData] = useState<DataState>(EMPTY);
  const [loadedCols, setLoadedCols] = useState<Set<string>>(new Set());
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(mode === "demo");
  const [accessError, setAccessError] = useState(false);
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

  const subscribe = useCallback((cols: CollectionName[]) => {
    const db = getAdapter();
    const unsubs = cols.map((col) =>
      db.subscribe(
        col,
        (docs) => {
          setData((d) => ({ ...d, [col]: docs }));
          setLoadedCols((s) => (s.has(col) ? s : new Set(s).add(col)));
        },
        () => {
          setAccessError(true);
          setLoadedCols((s) => (s.has(col) ? s : new Set(s).add(col)));
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  // ---- Fase 1: personal y configuración (para saber quién soy y mi rol) ----
  useEffect(() => {
    if (!canRead) return;
    return subscribe(BASE);
  }, [canRead, subscribe]);

  // ---- Usuario actual ----
  const staff = useMemo(() => data.staff.map((s) => (s.role === normalizeRole(s.role) ? s : { ...s, role: normalizeRole(s.role) })), [data.staff]);
  const me = useMemo<Staff | null>(() => {
    if (mode === "demo") return staff.find((s) => s.id === demoUserId && s.active) ?? null;
    if (!fbUser?.email) return null;
    const email = fbUser.email.toLowerCase();
    return staff.find((s) => (s.id === email || s.email.toLowerCase() === email) && s.active) ?? null;
  }, [mode, staff, demoUserId, fbUser]);
  const role = me?.role;

  // ---- Fase 2: sólo las colecciones que el rol puede ver ----
  const roleCols = useMemo(() => (role ? ROLE_COLLECTIONS[role].filter((c) => !BASE.includes(c)) : []), [role]);
  useEffect(() => {
    if (!canRead || !roleCols.length) return;
    const unsub = subscribe(roleCols);
    return () => {
      unsub();
      // al cambiar de usuario/rol se limpian los datos que ya no corresponden
      setData((d) => ({ ...EMPTY, staff: d.staff, settings: d.settings }));
      setLoadedCols((s) => new Set([...s].filter((c) => BASE.includes(c as CollectionName))));
    };
  }, [canRead, roleCols, subscribe]);

  const baseLoaded = BASE.every((c) => loadedCols.has(c));
  const loaded = baseLoaded && (!me || roleCols.every((c) => loadedCols.has(c)));

  // ---- Modo demo: sembrar datos la primera vez ----
  const seeded = useRef(false);
  useEffect(() => {
    if (mode !== "demo" || !baseLoaded || seeded.current) return;
    if (data.staff.length === 0 && data.settings.length === 0) {
      seeded.current = true;
      const seed = buildSeed();
      const db = getAdapter();
      COLLECTIONS.forEach((col) => db.bulkSet(col as CollectionName, seed[col] as never));
    }
  }, [mode, baseLoaded, data.staff.length, data.settings.length]);

  const settings = data.settings[0];
  const perms = useMemo(() => permsFor(role, settings), [role, settings]);
  const can = useCallback((p: Perm) => perms.includes(p), [perms]);

  const meRef = useRef(me);
  meRef.current = me;
  const actions = useMemo(() => makeActions(getAdapter(), () => dataRef.current, () => meRef.current), []);

  // ---- Índices ----
  const t = today();
  const idx = useMemo<Indexes>(() => {
    const openTasks = data.tasks.filter((x) => x.status !== "completada");
    const roomStates = new Map<string, RoomState>();
    const resByRoom = group(data.reservations, (r) => r.roomId);
    const openTasksByRoom = group(openTasks, (x) => x.roomId);
    for (const room of data.rooms)
      roomStates.set(room.id, roomState(room, { reservations: resByRoom.get(room.id) ?? [], tasks: openTasksByRoom.get(room.id) ?? [] }, t));
    return {
      roomById: new Map(data.rooms.map((r) => [r.id, r])),
      guestById: new Map(data.guests.map((g) => [g.id, g])),
      staffById: new Map(staff.map((s) => [s.id, s])),
      resById: new Map(data.reservations.map((r) => [r.id, r])),
      resByRoom,
      resByGuest: group(data.reservations, (r) => r.guestId),
      chargesByRes: group(data.charges, (c) => c.reservationId),
      paymentsByRes: group(data.payments, (p) => p.reservationId),
      openTasksByRoom,
      roomStates,
      roomsSorted: data.rooms.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    };
  }, [data.rooms, data.guests, staff, data.reservations, data.charges, data.payments, data.tasks, t]);

  const staffName = useCallback(
    (id?: string | null) => {
      if (!id) return "—";
      if (id === "sistema") return "Sistema";
      return idx.staffById.get(id)?.name ?? "Usuario eliminado";
    },
    [idx.staffById],
  );

  const dataView = useMemo(() => ({ ...data, staff }), [data, staff]);

  const value: Ctx = {
    mode,
    data: dataView,
    idx,
    loaded,
    me,
    perms,
    can,
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
