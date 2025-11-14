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
import { UserRole } from "./types";
import { useRole, useLanguagePreference, useUserStats } from "./useRole";
import type { UserStats } from "./storage";

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  clearRole: () => void;
  isVolunteer: boolean;
  isVisuallyImpaired: boolean;
  hasRole: boolean;
  language: string;
  setLanguage: (language: string) => void;
  stats: UserStats;
  refreshStats: () => void;
  recordCall: (durationSeconds: number, rating?: number) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

interface Props {
  children: ReactNode;
}

/**
 * Provider for user role and related BME state
 */
export const RoleProvider: FC<Props> = ({ children }) => {
  const roleState = useRole();
  const languageState = useLanguagePreference();
  const statsState = useUserStats();

  const value = useMemo<RoleContextValue>(
    () => ({
      ...roleState,
      ...languageState,
      ...statsState,
    }),
    [roleState, languageState, statsState],
  );

  return <RoleContext value={value}>{children}</RoleContext>;
};

/**
 * Hook to access role context
 */
export function useRoleContext(): RoleContextValue {
  const context = use(RoleContext);
  if (!context) {
    throw new Error("useRoleContext must be used within a RoleProvider");
  }
  return context;
}
