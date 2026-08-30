"use client";
import { createContext, useContext } from "react";
import type { useExpenseDraft } from "@/hooks/useExpenseDraft";
export const ExpenseDraftContext = createContext<ReturnType<
  typeof useExpenseDraft
> | null>(null);
export const useDraftContext = () => useContext(ExpenseDraftContext);
