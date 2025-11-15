/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { MatrixClient } from "matrix-js-sdk";
import { logger } from "matrix-js-sdk/lib/logger";
import { VolunteerPool } from "./VolunteerPool";
import { VolunteerStatus, type MatchResult, type HelpRequest } from "../types";
import { createRoom } from "../../utils/matrix";
import { E2eeType } from "../../e2ee/e2eeType";

/**
 * Service for matching visually impaired users with volunteers
 */
export class MatchingService {
  private client: MatrixClient;
  private volunteerPool: VolunteerPool;
  private currentCallRoomId: string | null = null;

  constructor(client: MatrixClient) {
    this.client = client;
    this.volunteerPool = new VolunteerPool(client);
  }

  /**
   * Initialize the matching service
   */
  async initialize(): Promise<void> {
    await this.volunteerPool.initialize();
  }

  /**
   * Register as a volunteer and create a waiting room
   * @param language Preferred language
   * @returns The room ID where the volunteer will wait
   */
  async registerAsVolunteer(language: string): Promise<string> {
    try {
      // Create a new room for this volunteer
      const roomName = `BME-Volunteer-${Date.now()}`;
      const { roomId, alias } = await createRoom(
        this.client,
        roomName,
        E2eeType.SHARED_KEY,
      );

      this.currentCallRoomId = roomId;

      // Register in the volunteer pool
      await this.volunteerPool.registerVolunteer(roomId, language);

      logger.info(`Registered as volunteer with room: ${roomId}`);

      return roomId;
    } catch (error) {
      logger.error("Failed to register as volunteer", error);
      throw error;
    }
  }

  /**
   * Update volunteer status
   */
  async updateVolunteerStatus(status: VolunteerStatus): Promise<void> {
    await this.volunteerPool.updateStatus(status);
  }

  /**
   * Unregister from volunteer pool and clean up
   */
  async unregisterAsVolunteer(): Promise<void> {
    try {
      await this.volunteerPool.unregisterVolunteer();

      // Optionally leave the waiting room
      if (this.currentCallRoomId) {
        try {
          await this.client.leave(this.currentCallRoomId);
        } catch (error) {
          logger.warn("Failed to leave volunteer room", error);
        }
        this.currentCallRoomId = null;
      }

      logger.info("Unregistered as volunteer");
    } catch (error) {
      logger.error("Failed to unregister as volunteer", error);
      throw error;
    }
  }

  /**
   * Request help from a volunteer (for visually impaired users)
   * @param language Preferred language
   * @returns Match result with room to join
   */
  async requestHelp(language: string): Promise<MatchResult> {
    try {
      logger.info(`[MatchingService] Requesting help with language: ${language}`);

      const matchResult = await this.volunteerPool.findAvailableVolunteer(
        language,
      );

      logger.info(`[MatchingService] Match result:`, matchResult);

      if (matchResult.success && matchResult.roomId) {
        // Join the volunteer's room
        try {
          logger.info(`[MatchingService] Joining volunteer room: ${matchResult.roomId}`);
          await this.client.joinRoom(matchResult.roomId);

          // Wait for room to be available in client
          logger.info(`[MatchingService] Waiting for room to sync...`);
          await this.waitForRoom(matchResult.roomId);

          this.currentCallRoomId = matchResult.roomId;
          logger.info(`[MatchingService] Successfully joined volunteer room: ${matchResult.roomId}`);
        } catch (error) {
          logger.error("[MatchingService] Failed to join volunteer room", error);
          return {
            success: false,
            error: "Failed to connect to volunteer",
          };
        }
      } else {
        logger.warn(`[MatchingService] No match found: ${matchResult.error || "Unknown reason"}`);
      }

      return matchResult;
    } catch (error) {
      logger.error("[MatchingService] Failed to request help", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wait for room to be synced and available
   */
  private async waitForRoom(roomId: string, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const room = this.client.getRoom(roomId);
      if (room) {
        logger.info(`[MatchingService] Room ${roomId} is available (attempt ${i + 1})`);
        return;
      }

      logger.info(
        `[MatchingService] Waiting for room ${roomId} to sync... (attempt ${i + 1}/${maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s
    }

    throw new Error(`Room ${roomId} did not sync after ${maxAttempts} attempts`);
  }

  /**
   * Get the number of available volunteers
   */
  async getAvailableVolunteersCount(): Promise<number> {
    return await this.volunteerPool.getAvailableCount();
  }

  /**
   * Leave the current call room
   */
  async leaveCurrentCall(): Promise<void> {
    if (this.currentCallRoomId) {
      try {
        await this.client.leave(this.currentCallRoomId);
        logger.info(`Left call room: ${this.currentCallRoomId}`);
      } catch (error) {
        logger.error("Failed to leave call room", error);
      }
      this.currentCallRoomId = null;
    }
  }

  /**
   * Clean up and disconnect
   */
  async cleanup(): Promise<void> {
    await this.volunteerPool.leave();
    await this.leaveCurrentCall();
  }

  /**
   * Get current call room ID
   */
  getCurrentCallRoomId(): string | null {
    return this.currentCallRoomId;
  }
}
