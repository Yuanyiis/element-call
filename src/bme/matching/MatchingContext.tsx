/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  createContext,
  type FC,
  type ReactNode,
  use,
  useMemo,
} from "react";
import { useClientLegacy } from "../../ClientContext";
import { useMatching, MatchingState } from "./useMatching";
import type { MatchResult } from "../types";

interface MatchingContextValue {
  state: MatchingState;
  error: string | null;
  matchResult: MatchResult | null;
  availableVolunteers: number;

  // Volunteer functions
  registerAsVolunteer: (language: string) => Promise<void>;
  unregisterAsVolunteer: () => Promise<void>;
  markAsBusy: () => Promise<void>;
  markAsAvailable: () => Promise<void>;

  // Help seeker functions
  requestHelp: (language: string) => Promise<void>;
  cancelHelpRequest: () => void;

  // Common
  leaveCall: () => Promise<void>;
  refreshAvailableCount: () => Promise<void>;

  // Helper states
  isWaiting: boolean;
  isSearching: boolean;
  isMatched: boolean;
  isError: boolean;
  isIdle: boolean;
}

const MatchingContext = createContext<MatchingContextValue | null>(null);

interface Props {
  children: ReactNode;
}

/**
 * Provider for matching service
 */
export const MatchingProvider: FC<Props> = ({ children }) => {
  const { client } = useClientLegacy();
  const matching = useMatching(client);

  const value = useMemo<MatchingContextValue>(
    () => ({
      ...matching,
      isWaiting: matching.state === MatchingState.WaitingAsVolunteer,
      isSearching: matching.state === MatchingState.SearchingForVolunteer,
      isMatched: matching.state === MatchingState.Matched,
      isError: matching.state === MatchingState.Error,
      isIdle: matching.state === MatchingState.Idle,
    }),
    [matching],
  );

  return (
    <MatchingContext value={value}>{children}</MatchingContext>
  );
};

/**
 * Hook to access matching context
 */
export function useMatchingContext(): MatchingContextValue {
  const context = use(MatchingContext);
  if (!context) {
    throw new Error(
      "useMatchingContext must be used within a MatchingProvider",
    );
  }
  return context;
}
