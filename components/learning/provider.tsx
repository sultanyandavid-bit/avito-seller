"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import {
  emptyTraining,
  parseTraining,
  saveExample,
} from "@/lib/learning/repository";
import {
  trainingKey,
  type TrainingData,
  type ExampleInput,
  type TrainingExample,
} from "@/lib/learning/types";
const Context = createContext<{
  data: TrainingData;
  ready: boolean;
  error: string;
  save: (input: ExampleInput, id?: string) => void;
  remove: (id: string) => void;
} | null>(null);
export function LearningProvider({
  storeId,
  children,
}: {
  storeId: string;
  children: React.ReactNode;
}) {
  const seed = useMemo(() => emptyTraining(storeId), [storeId]);
  const parse = useCallback(
    (raw: string) => parseTraining(raw, storeId),
    [storeId],
  );
  const { data, update, ready, error } = usePersistentState(
    trainingKey(storeId),
    seed,
    parse,
  );
  const save = (input: ExampleInput, id?: string) => {
    const next = saveExample(data, input, id);
    update(next);
  };
  return (
    <Context.Provider
      value={{
        data,
        ready,
        error,
        save,
        remove(id) {
          update((d) => ({
            ...d,
            examples: d.examples.filter((e: TrainingExample) => e.id !== id),
          }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLearning() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing learning provider");
  return ctx;
}
