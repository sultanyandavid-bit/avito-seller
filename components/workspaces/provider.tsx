"use client";
import { createContext, useContext } from "react";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import {
  workspaceSeed,
  workspaceKey,
  parseWorkspace,
  type LocalWorkspace,
} from "@/lib/workspaces/types";
const Context = createContext<{
  workspace: LocalWorkspace;
  ready: boolean;
  error: string;
  choose: (id: string) => void;
  create: (name: string) => string | null;
  rename: (id: string, name: string) => void;
} | null>(null);
export function LocalWorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, update, ready, error } = usePersistentState(
    workspaceKey,
    workspaceSeed,
    parseWorkspace,
  );
  return (
    <Context.Provider
      value={{
        workspace: data,
        ready,
        error,
        choose(id) {
          if (data.stores.some((s) => s.id === id))
            update((s) => ({ ...s, activeStoreId: id }));
        },
        create(name) {
          if (
            !name.trim() ||
            name.trim().length > 60 ||
            data.stores.length >= 30
          )
            return null;
          const id = crypto.randomUUID();
          update((s) => ({
            ...s,
            activeStoreId: id,
            stores: [...s.stores, { id, name: name.trim() }],
          }));
          return id;
        },
        rename(id, name) {
          if (data.stores.find((s) => s.id === id)?.name !== name)
            update((s) => ({
              ...s,
              stores: s.stores.map((t) => (t.id === id ? { ...t, name } : t)),
            }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocalWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing local workspace provider");
  return ctx;
}
