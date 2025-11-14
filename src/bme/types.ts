/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * User roles in the Be My Eyes Helper system
 */
export enum UserRole {
  /**
   * A volunteer who provides visual assistance to visually impaired users
   */
  Volunteer = "volunteer",

  /**
   * A visually impaired user seeking assistance
   */
  VisuallyImpaired = "visually_impaired",

  /**
   * No role selected yet
   */
  None = "none",
}

/**
 * Volunteer status in the matching pool
 */
export enum VolunteerStatus {
  /**
   * Available and waiting for help requests
   */
  Available = "available",

  /**
   * Currently in a call helping someone
   */
  Busy = "busy",

  /**
   * Offline or not in the volunteer pool
   */
  Offline = "offline",
}

/**
 * Volunteer profile stored in the matching pool
 */
export interface VolunteerProfile {
  /** User ID */
  userId: string;

  /** Room ID where the volunteer is waiting */
  callRoomId: string;

  /** Current status */
  status: VolunteerStatus;

  /** Preferred language (ISO 639-1 code, e.g., 'zh', 'en') */
  language: string;

  /** Timestamp when this status was set */
  timestamp: number;

  /** Optional: Supported languages */
  supportedLanguages?: string[];

  /** Optional: Display name */
  displayName?: string;
}

/**
 * Help request from a visually impaired user
 */
export interface HelpRequest {
  /** Unique request ID */
  requestId: string;

  /** User ID of the person requesting help */
  userId: string;

  /** Preferred language */
  language: string;

  /** Timestamp when the request was created */
  timestamp: number;

  /** Optional: Priority (default: 0, higher = more urgent) */
  priority?: number;

  /** Optional: Display name */
  displayName?: string;
}

/**
 * Matching result
 */
export interface MatchResult {
  /** Whether a match was found */
  success: boolean;

  /** Room ID to join (if successful) */
  roomId?: string;

  /** Volunteer profile (if successful) */
  volunteer?: VolunteerProfile;

  /** Error message (if failed) */
  error?: string;

  /** Number of volunteers currently available (for UI display) */
  availableVolunteers?: number;
}

/**
 * Call feedback after a session ends
 */
export interface CallFeedback {
  /** Call/Room ID */
  callId: string;

  /** Rating from 1-5 */
  rating: number;

  /** Optional comment */
  comment?: string;

  /** Whether the help was useful */
  helpful: boolean;

  /** Call duration in seconds */
  duration: number;

  /** Timestamp */
  timestamp: number;

  /** Role of the person giving feedback */
  role: UserRole;
}
