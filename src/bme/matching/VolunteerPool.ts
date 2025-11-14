/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { logger } from "matrix-js-sdk/lib/logger";
import {
  VolunteerProfile,
  VolunteerStatus,
  type MatchResult,
} from "../types";

/**
 * Manages the volunteer pool using a Matrix room
 * Volunteers join this room and update their status via state events
 */
export class VolunteerPool {
  private readonly POOL_ROOM_ALIAS = "#bme-volunteer-pool";
  private readonly STATUS_EVENT_TYPE = "org.bme.volunteer.status";
  private readonly STATUS_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  private client: MatrixClient;
  private poolRoom: Room | null = null;
  private serverName: string;

  constructor(client: MatrixClient) {
    this.client = client;
    // Extract server name from user ID (e.g., @user:server.com -> server.com)
    const userId = client.getUserId();
    this.serverName = userId ? userId.split(":")[1] : "matrix.org";
  }

  /**
   * Get the full room alias including server name
   */
  private getPoolRoomAlias(): string {
    return `${this.POOL_ROOM_ALIAS}:${this.serverName}`;
  }

  /**
   * Initialize and join the volunteer pool room
   * Creates the room if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      const roomAlias = this.getPoolRoomAlias();
      logger.info(`Initializing volunteer pool: ${roomAlias}`);

      try {
        // Try to join existing room
        const { room_id } = await this.client.getRoomIdForAlias(roomAlias);
        await this.client.joinRoom(room_id);
        this.poolRoom = this.client.getRoom(room_id);
        logger.info(`Joined existing volunteer pool: ${room_id}`);
      } catch (error) {
        // Room doesn't exist, create it
        logger.info("Volunteer pool doesn't exist, creating...");
        const { room_id } = await this.client.createRoom({
          room_alias_name: this.POOL_ROOM_ALIAS.substring(1), // Remove #
          name: "BME Volunteer Pool",
          topic:
            "Volunteer matching pool for Be My Eyes Helper - Do not join manually",
          preset: "public_chat" as any,
          visibility: "private" as any,
          power_level_content_override: {
            users_default: 0,
            events_default: 0,
            state_default: 0,
            events: {
              [this.STATUS_EVENT_TYPE]: 0, // Everyone can update their status
            },
          },
        });

        this.poolRoom = this.client.getRoom(room_id);
        logger.info(`Created volunteer pool: ${room_id}`);
      }
    } catch (error) {
      logger.error("Failed to initialize volunteer pool", error);
      throw error;
    }
  }

  /**
   * Register as an available volunteer
   */
  async registerVolunteer(
    callRoomId: string,
    language: string,
  ): Promise<void> {
    if (!this.poolRoom) {
      throw new Error("Volunteer pool not initialized");
    }

    const userId = this.client.getUserId();
    if (!userId) {
      throw new Error("No user ID");
    }

    const profile: VolunteerProfile = {
      userId,
      callRoomId,
      status: VolunteerStatus.Available,
      language,
      timestamp: Date.now(),
      displayName: this.client.getUser(userId)?.displayName,
    };

    try {
      await this.client.sendStateEvent(
        this.poolRoom.roomId,
        this.STATUS_EVENT_TYPE,
        profile,
        userId, // Use userId as state key for uniqueness
      );

      logger.info(`Registered as volunteer in pool: ${callRoomId}`);
    } catch (error) {
      logger.error("Failed to register volunteer", error);
      throw error;
    }
  }

  /**
   * Update volunteer status
   */
  async updateStatus(status: VolunteerStatus): Promise<void> {
    if (!this.poolRoom) {
      throw new Error("Volunteer pool not initialized");
    }

    const userId = this.client.getUserId();
    if (!userId) {
      throw new Error("No user ID");
    }

    try {
      // Get current profile
      const currentEvent = this.poolRoom.currentState.getStateEvents(
        this.STATUS_EVENT_TYPE,
        userId,
      );

      if (!currentEvent) {
        throw new Error("Volunteer not registered");
      }

      const currentProfile = currentEvent.getContent() as VolunteerProfile;

      // Update status
      const updatedProfile: VolunteerProfile = {
        ...currentProfile,
        status,
        timestamp: Date.now(),
      };

      await this.client.sendStateEvent(
        this.poolRoom.roomId,
        this.STATUS_EVENT_TYPE,
        updatedProfile,
        userId,
      );

      logger.info(`Updated volunteer status to: ${status}`);
    } catch (error) {
      logger.error("Failed to update volunteer status", error);
      throw error;
    }
  }

  /**
   * Unregister from the volunteer pool
   */
  async unregisterVolunteer(): Promise<void> {
    try {
      await this.updateStatus(VolunteerStatus.Offline);
      logger.info("Unregistered from volunteer pool");
    } catch (error) {
      logger.error("Failed to unregister volunteer", error);
      throw error;
    }
  }

  /**
   * Find an available volunteer matching the language preference
   */
  async findAvailableVolunteer(language: string): Promise<MatchResult> {
    if (!this.poolRoom) {
      await this.initialize();
    }

    if (!this.poolRoom) {
      return {
        success: false,
        error: "Volunteer pool not available",
      };
    }

    try {
      // Get all status events
      const statusEvents = this.poolRoom.currentState.getStateEvents(
        this.STATUS_EVENT_TYPE,
      );

      const now = Date.now();
      const availableVolunteers: VolunteerProfile[] = [];

      for (const event of statusEvents) {
        const profile = event.getContent() as VolunteerProfile;

        // Check if volunteer is available and not timed out
        if (
          profile.status === VolunteerStatus.Available &&
          now - profile.timestamp < this.STATUS_TIMEOUT
        ) {
          availableVolunteers.push(profile);
        }
      }

      if (availableVolunteers.length === 0) {
        return {
          success: false,
          error: "No volunteers available",
          availableVolunteers: 0,
        };
      }

      // Try to match by language first
      let matchedVolunteer = availableVolunteers.find(
        (v) => v.language === language,
      );

      // If no exact match, pick random volunteer
      if (!matchedVolunteer) {
        const randomIndex = Math.floor(
          Math.random() * availableVolunteers.length,
        );
        matchedVolunteer = availableVolunteers[randomIndex];
      }

      logger.info(
        `Matched with volunteer: ${matchedVolunteer.userId} in room: ${matchedVolunteer.callRoomId}`,
      );

      return {
        success: true,
        roomId: matchedVolunteer.callRoomId,
        volunteer: matchedVolunteer,
        availableVolunteers: availableVolunteers.length,
      };
    } catch (error) {
      logger.error("Failed to find available volunteer", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get count of available volunteers
   */
  async getAvailableCount(): Promise<number> {
    if (!this.poolRoom) {
      return 0;
    }

    try {
      const statusEvents = this.poolRoom.currentState.getStateEvents(
        this.STATUS_EVENT_TYPE,
      );

      const now = Date.now();
      let count = 0;

      for (const event of statusEvents) {
        const profile = event.getContent() as VolunteerProfile;
        if (
          profile.status === VolunteerStatus.Available &&
          now - profile.timestamp < this.STATUS_TIMEOUT
        ) {
          count++;
        }
      }

      return count;
    } catch (error) {
      logger.error("Failed to get available volunteer count", error);
      return 0;
    }
  }

  /**
   * Leave the volunteer pool room
   */
  async leave(): Promise<void> {
    if (this.poolRoom) {
      try {
        await this.client.leave(this.poolRoom.roomId);
        this.poolRoom = null;
        logger.info("Left volunteer pool");
      } catch (error) {
        logger.error("Failed to leave volunteer pool", error);
      }
    }
  }
}
