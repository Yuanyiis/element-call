/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { UserRole } from "./types";

const STORAGE_KEYS = {
  ROLE: "bme_user_role",
  LANGUAGE: "bme_user_language",
  VOLUNTEER_ROOM_ID: "bme_volunteer_room_id",
  ONBOARDING_COMPLETED: "bme_onboarding_completed",
  STATS: "bme_user_stats",
} as const;

/**
 * User statistics
 */
export interface UserStats {
  /** Total number of calls participated in */
  totalCalls: number;

  /** Total call duration in seconds */
  totalDuration: number;

  /** Number of calls today */
  callsToday: number;

  /** Last call timestamp */
  lastCallTimestamp?: number;

  /** Average rating received (for volunteers) */
  averageRating?: number;

  /** Total ratings count */
  ratingsCount?: number;
}

/**
 * Storage service for BME (Be My Eyes) related data
 */
export class BMEStorage {
  /**
   * Get the user's selected role
   */
  static getRole(): UserRole {
    const role = localStorage.getItem(STORAGE_KEYS.ROLE);
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      return role as UserRole;
    }
    return UserRole.None;
  }

  /**
   * Set the user's role
   */
  static setRole(role: UserRole): void {
    localStorage.setItem(STORAGE_KEYS.ROLE, role);
  }

  /**
   * Clear the user's role
   */
  static clearRole(): void {
    localStorage.removeItem(STORAGE_KEYS.ROLE);
  }

  /**
   * Get the user's preferred language
   */
  static getLanguage(): string {
    return localStorage.getItem(STORAGE_KEYS.LANGUAGE) || "en";
  }

  /**
   * Set the user's preferred language
   */
  static setLanguage(language: string): void {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  }

  /**
   * Get the volunteer's waiting room ID
   */
  static getVolunteerRoomId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.VOLUNTEER_ROOM_ID);
  }

  /**
   * Set the volunteer's waiting room ID
   */
  static setVolunteerRoomId(roomId: string): void {
    localStorage.setItem(STORAGE_KEYS.VOLUNTEER_ROOM_ID, roomId);
  }

  /**
   * Clear the volunteer's waiting room ID
   */
  static clearVolunteerRoomId(): void {
    localStorage.removeItem(STORAGE_KEYS.VOLUNTEER_ROOM_ID);
  }

  /**
   * Check if onboarding has been completed
   */
  static hasCompletedOnboarding(): boolean {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === "true";
  }

  /**
   * Mark onboarding as completed
   */
  static setOnboardingCompleted(): void {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
  }

  /**
   * Get user statistics
   */
  static getStats(): UserStats {
    const statsJson = localStorage.getItem(STORAGE_KEYS.STATS);
    if (statsJson) {
      try {
        return JSON.parse(statsJson);
      } catch (e) {
        console.error("Failed to parse user stats", e);
      }
    }

    return {
      totalCalls: 0,
      totalDuration: 0,
      callsToday: 0,
    };
  }

  /**
   * Update user statistics
   */
  static updateStats(updater: (stats: UserStats) => UserStats): void {
    const currentStats = this.getStats();
    const newStats = updater(currentStats);
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(newStats));
  }

  /**
   * Increment call count and update duration
   */
  static recordCall(durationSeconds: number, rating?: number): void {
    this.updateStats((stats) => {
      const now = Date.now();
      const lastCallDate = stats.lastCallTimestamp
        ? new Date(stats.lastCallTimestamp).toDateString()
        : null;
      const today = new Date(now).toDateString();

      const callsToday =
        lastCallDate === today ? stats.callsToday + 1 : 1;

      const newStats: UserStats = {
        totalCalls: stats.totalCalls + 1,
        totalDuration: stats.totalDuration + durationSeconds,
        callsToday,
        lastCallTimestamp: now,
      };

      // Update rating if provided (for volunteers)
      if (rating !== undefined) {
        const currentTotal = (stats.averageRating || 0) * (stats.ratingsCount || 0);
        const newCount = (stats.ratingsCount || 0) + 1;
        newStats.averageRating = (currentTotal + rating) / newCount;
        newStats.ratingsCount = newCount;
      }

      return newStats;
    });
  }

  /**
   * Clear all BME data
   */
  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  }
}
