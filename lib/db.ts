"use client";
// Capa de persistencia con dos implementaciones intercambiables:
//  - Firestore (tiempo real, multiusuario) cuando hay variables NEXT_PUBLIC_FIREBASE_*
//  - LocalStorage (modo demo) cuando no las hay
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { fb, firebaseEnabled } from "./firebase";
import type { CollectionName } from "./types";

type Doc = { id: string } & Record<string, unknown>;

export interface Adapter {
  kind: "firebase" | "demo";
  subscribe(col: CollectionName, cb: (docs: Doc[]) => void, onError?: (e: Error) => void): () => void;
  set(col: CollectionName, id: string, data: object): Promise<void>;
  update(col: CollectionName, id: string, data: object): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  /** Crea el documento sólo si no existe. Devuelve true si lo creó. */
  createIfMissing(col: CollectionName, id: string, data: object): Promise<boolean>;
  bulkSet(col: CollectionName, docs: Doc[]): Promise<void>;
  clear(col: CollectionName, ids: string[]): Promise<void>;
}

/** Firestore no acepta `undefined`: lo eliminamos. */
function clean<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

// ---------------- Firestore ----------------
function firestoreAdapter(): Adapter {
  const { db } = fb();
  return {
    kind: "firebase",
    subscribe(col, cb, onError) {
      // El registro de actividad crece siempre: sólo traemos lo más reciente
      const ref = col === "activity" ? query(collection(db, col), orderBy("at", "desc"), limit(1000)) : collection(db, col);
      return onSnapshot(
        ref,
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Doc)),
        (err) => {
          console.error(`[firestore] ${col}`, err);
          onError?.(err);
        },
      );
    },
    async set(col, id, data) {
      await setDoc(doc(db, col, id), clean({ ...data, id }));
    },
    async update(col, id, data) {
      await updateDoc(doc(db, col, id), clean(data) as Record<string, unknown>);
    },
    async remove(col, id) {
      await deleteDoc(doc(db, col, id));
    },
    async createIfMissing(col, id, data) {
      return runTransaction(db, async (tx) => {
        const ref = doc(db, col, id);
        const snap = await tx.get(ref);
        if (snap.exists()) return false;
        tx.set(ref, clean({ ...data, id }));
        return true;
      });
    },
    async bulkSet(col, docs) {
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.set(doc(db, col, d.id), clean(d)));
        await batch.commit();
      }
    },
    async clear(col, ids) {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, col, id)));
        await batch.commit();
      }
    },
  };
}

// ---------------- LocalStorage (demo) ----------------
const LS_PREFIX = "hotel-pms:";

function localAdapter(): Adapter {
  const listeners = new Map<CollectionName, Set<(docs: Doc[]) => void>>();
  const cache = new Map<CollectionName, Map<string, Doc>>();

  const load = (col: CollectionName) => {
    if (!cache.has(col)) {
      let arr: Doc[] = [];
      try {
        arr = JSON.parse(localStorage.getItem(LS_PREFIX + col) || "[]");
      } catch {
        arr = [];
      }
      cache.set(col, new Map(arr.map((d) => [d.id, d])));
    }
    return cache.get(col)!;
  };
  const emit = (col: CollectionName) => {
    const docs = Array.from(load(col).values());
    try {
      localStorage.setItem(LS_PREFIX + col, JSON.stringify(docs));
    } catch (e) {
      console.warn("localStorage lleno", e);
    }
    listeners.get(col)?.forEach((cb) => cb(docs));
  };

  // Sincronización entre pestañas
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (!e.key?.startsWith(LS_PREFIX)) return;
      const col = e.key.slice(LS_PREFIX.length) as CollectionName;
      cache.delete(col);
      const docs = Array.from(load(col).values());
      listeners.get(col)?.forEach((cb) => cb(docs));
    });
  }

  return {
    kind: "demo",
    subscribe(col, cb) {
      if (!listeners.has(col)) listeners.set(col, new Set());
      listeners.get(col)!.add(cb);
      queueMicrotask(() => cb(Array.from(load(col).values())));
      return () => listeners.get(col)!.delete(cb);
    },
    async set(col, id, data) {
      load(col).set(id, clean({ ...data, id }) as Doc);
      emit(col);
    },
    async update(col, id, data) {
      const m = load(col);
      const cur = m.get(id);
      if (!cur) return;
      m.set(id, clean({ ...cur, ...data, id }) as Doc);
      emit(col);
    },
    async remove(col, id) {
      load(col).delete(id);
      emit(col);
    },
    async createIfMissing(col, id, data) {
      const m = load(col);
      if (m.has(id)) return false;
      m.set(id, clean({ ...data, id }) as Doc);
      emit(col);
      return true;
    },
    async bulkSet(col, docs) {
      const m = load(col);
      docs.forEach((d) => m.set(d.id, clean(d)));
      emit(col);
    },
    async clear(col, ids) {
      const m = load(col);
      ids.forEach((id) => m.delete(id));
      emit(col);
    },
  };
}

/** Firebase: el primer usuario que inicia sesión queda como administrador (una sola vez). */
export async function bootstrapFirstAdmin(email: string, name: string): Promise<boolean> {
  const { db } = fb();
  const metaRef = doc(db, "meta", "bootstrap");
  const snap = await getDoc(metaRef);
  if (snap.exists()) return false;
  const id = email.toLowerCase();
  const batch = writeBatch(db);
  batch.set(metaRef, { at: new Date().toISOString(), by: id });
  batch.set(doc(db, "staff", id), { id, name, email: id, role: "admin", active: true, createdAt: new Date().toISOString() });
  await batch.commit();
  return true;
}

let adapter: Adapter | null = null;
export function getAdapter(): Adapter {
  if (!adapter) adapter = firebaseEnabled ? firestoreAdapter() : localAdapter();
  return adapter;
}
