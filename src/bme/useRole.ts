/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useState, useEffect, useCallback } from "react";
import { UserRole } from "./types";
import { BMEStorage } from "./storage";

/**
 * Hook for managing user role selection and persistence
 */
export function useRole(): {
  role: UserRole;
  setRole: (role: UserRole) => void;
  clearRole: () => void;
  isVolunteer: boolean;
  isVisuallyImpaired: boolean;
  hasRole: boolean;
} {
  const [role, setRoleState] = useState<UserRole>(() => BMEStorage.getRole());

  // Sync with localStorage
  const setRole = useCallback((newRole: UserRole) => {
    BMEStorage.setRole(newRole);
    setRoleState(newRole);
  }, []);

  const clearRole = useCallback(() => {
    BMEStorage.clearRole();
    setRoleState(UserRole.None);
  }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === "bme_user_role" && e.newValue) {
        setRoleState(e.newValue as UserRole);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return {
    role,
    setRole,
    clearRole,
    isVolunteer: role === UserRole.Volunteer,
    isVisuallyImpaired: role === UserRole.VisuallyImpaired,
    hasRole: role !== UserRole.None,
  };
}

/**
 * Hook for managing user language preference
 */
export function useLanguagePreference(): {
  language: string;
  setLanguage: (language: string) => void;
} {
  const [language, setLanguageState] = useState<string>(() =>
    BMEStorage.getLanguage(),
  );

  const setLanguage = useCallback((newLanguage: string) => {
    BMEStorage.setLanguage(newLanguage);
    setLanguageState(newLanguage);
  }, []);

  return {
    language,
    setLanguage,
  };
}

/**
 * Hook for managing user statistics
 */
export function useUserStats() {
  const [stats, setStats] = useState(() => BMEStorage.getStats());

  const refreshStats = useCallback(() => {
    setStats(BMEStorage.getStats());
  }, []);

  const recordCall = useCallback(
    (durationSeconds: number, rating?: number) => {
      BMEStorage.recordCall(durationSeconds, rating);
      refreshStats();
    },
    [refreshStats],
  );

  return {
    stats,
    refreshStats,
    recordCall,
  };
}
