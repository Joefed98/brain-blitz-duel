import { createContext, useContext } from "react";

/**
 * True inside a live game column (and intro demos recorded with the current
 * column layout). Stages whose old layout cannot be expressed in CSS alone use
 * it to switch structure without moving touches in older recorded demos.
 */
export const GameColumnLayout = createContext(false);

export function useGameColumnLayout(): boolean {
  return useContext(GameColumnLayout);
}
