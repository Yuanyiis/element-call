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
      const { room_id, room_alias } = await createRoom(
        this.client,
        roomName,
        E2eeType.SHARED_KEY,
      );

      this.currentCallRoomId = room_id;

      // Register in the volunteer pool
      await this.volunteerPool.registerVolunteer(room_id, language);

      logger.info(`Registered as volunteer with room: ${room_id}`);

      return room_id;
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
      logger.info(`Requesting help with language: ${language}`);

      const matchResult = await this.volunteerPool.findAvailableVolunteer(
        language,
      );

      if (matchResult.success && matchResult.roomId) {
        // Join the volunteer's room
        try {
          await this.client.joinRoom(matchResult.roomId);
          this.currentCallRoomId = matchResult.roomId;
          logger.info(`Joined volunteer room: ${matchResult.roomId}`);
        } catch (error) {
          logger.error("Failed to join volunteer room", error);
          return {
            success: false,
            error: "Failed to connect to volunteer",
          };
        }
      }

      return matchResult;
    } catch (error) {
      logger.error("Failed to request help", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
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
