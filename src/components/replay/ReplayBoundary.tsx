import { Component, type ReactNode } from "react";

/**
 * Replays are display only: a replay that fails (a draw error, an odd stored
 * run) must never take the results screen or the podium down with it. Anything
 * thrown inside renders nothing instead.
 */
export class ReplayBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    console.error("[replay] panel failed", error);
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
