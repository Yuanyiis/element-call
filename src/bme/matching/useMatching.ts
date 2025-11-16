/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useState, useEffect, useCallback, useRef } from "react";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { RoomStateEvent } from "matrix-js-sdk";
import { logger } from "matrix-js-sdk/lib/logger";
import { MatchingService } from "./MatchingService";
import { VolunteerStatus, type MatchResult } from "../types";

export enum MatchingState {
  Idle = "idle",
  Initializing = "initializing",
  WaitingAsVolunteer = "waiting_as_volunteer",
  SearchingForVolunteer = "searching_for_volunteer",
  Matched = "matched",
  Error = "error",
}

interface UseMatchingResult {
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
}

/**
 * Hook for managing matching between volunteers and help seekers
 */
export function useMatching(client: MatrixClient | null): UseMatchingResult {
  const [state, setState] = useState<MatchingState>(MatchingState.Idle);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [availableVolunteers, setAvailableVolunteers] = useState(0);

  const serviceRef = useRef<MatchingService | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const membershipListenerRef = useRef<((event: MatrixEvent) => void) | null>(null);
  const volunteerRoomIdRef = useRef<string | null>(null);

  // Initialize matching service when client is available
  useEffect(() => {
    if (!client) {
      serviceRef.current = null;
      return;
    }

    const service = new MatchingService(client);

    service
      .initialize()
      .then(() => {
        serviceRef.current = service;
        logger.info("Matching service initialized");
      })
      .catch((err) => {
        logger.error("Failed to initialize matching service", err);
        setError("Failed to initialize matching service");
        setState(MatchingState.Error);
      });

    return () => {
      service.cleanup().catch((err) => {
        logger.error("Failed to cleanup matching service", err);
      });
    };
  }, [client]);

  // Cleanup polling and listeners on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      cleanupRoomMembershipListener();
    };
  }, [cleanupRoomMembershipListener]);

  // Refresh available volunteer count
  const refreshAvailableCount = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      const count = await serviceRef.current.getAvailableVolunteersCount();
      setAvailableVolunteers(count);
    } catch (err) {
      logger.error("Failed to get available volunteers count", err);
    }
  }, []);

  // Start polling for available volunteers
  const startPolling = useCallback(() => {
    // Initial fetch
    refreshAvailableCount();

    // Poll every 5 seconds
    if (!pollingIntervalRef.current) {
      pollingIntervalRef.current = window.setInterval(() => {
        refreshAvailableCount();
      }, 5000);
    }
  }, [refreshAvailableCount]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Setup room membership listener for volunteers
  const setupRoomMembershipListener = useCallback(
    (roomId: string) => {
      if (!client) return;

      // Remove existing listener if any
      if (membershipListenerRef.current && volunteerRoomIdRef.current) {
        const oldRoom = client.getRoom(volunteerRoomIdRef.current);
        if (oldRoom) {
          oldRoom.off(RoomStateEvent.Members, membershipListenerRef.current);
        }
      }

      volunteerRoomIdRef.current = roomId;

      // Create new listener
      const membershipListener = (event: MatrixEvent): void => {
        const room = client.getRoom(roomId);
        if (!room) return;

        const joinedMembers = room.getJoinedMembers();
        logger.info(
          `[Room ${roomId}] Membership changed. Joined members: ${joinedMembers.length}`,
        );

        // If more than one member (volunteer + help seeker), we have a match!
        if (joinedMembers.length > 1) {
          logger.info(
            `[Room ${roomId}] Help seeker joined! Transitioning to Matched state.`,
          );
          setState(MatchingState.Matched);
          // Remove listener since we're now matched
          room.off(RoomStateEvent.Members, membershipListener);
          membershipListenerRef.current = null;
        }
      };

      membershipListenerRef.current = membershipListener;

      // Wait for room to be available and set up listener
      const waitForRoomAndListen = async (): Promise<void> => {
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
          const room = client.getRoom(roomId);
          if (room) {
            logger.info(
              `[Room ${roomId}] Room synced, setting up membership listener. Current members: ${room.getJoinedMembers().length}`,
            );
            room.on(RoomStateEvent.Members, membershipListener);

            // Check if someone already joined while we were waiting
            const joinedMembers = room.getJoinedMembers();
            if (joinedMembers.length > 1) {
              logger.info(
                `[Room ${roomId}] Help seeker already joined! Transitioning to Matched state.`,
              );
              setState(MatchingState.Matched);
              room.off(RoomStateEvent.Members, membershipListener);
              membershipListenerRef.current = null;
            }
            return;
          }

          logger.info(
            `[Room ${roomId}] Waiting for room to sync... (attempt ${attempts + 1}/${maxAttempts})`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }

        logger.warn(`[Room ${roomId}] Room did not sync after ${maxAttempts} attempts`);
      };

      waitForRoomAndListen().catch((err) => {
        logger.error("Failed to setup room membership listener", err);
      });
    },
    [client],
  );

  // Cleanup room membership listener
  const cleanupRoomMembershipListener = useCallback(() => {
    if (client && membershipListenerRef.current && volunteerRoomIdRef.current) {
      const room = client.getRoom(volunteerRoomIdRef.current);
      if (room) {
        room.off(RoomStateEvent.Members, membershipListenerRef.current);
        logger.info(
          `[Room ${volunteerRoomIdRef.current}] Removed membership listener`,
        );
      }
      membershipListenerRef.current = null;
      volunteerRoomIdRef.current = null;
    }
  }, [client]);

  // Register as volunteer
  const registerAsVolunteer = useCallback(
    async (language: string) => {
      if (!serviceRef.current) {
        throw new Error("Matching service not initialized");
      }

      try {
        setState(MatchingState.Initializing);
        setError(null);

        const roomId = await serviceRef.current.registerAsVolunteer(language);

        setState(MatchingState.WaitingAsVolunteer);
        setMatchResult({ success: true, roomId });

        // Start polling for stats
        startPolling();

        // Setup listener for when help seekers join
        setupRoomMembershipListener(roomId);

        logger.info("Successfully registered as volunteer");
      } catch (err) {
        logger.error("Failed to register as volunteer", err);
        setError(
          err instanceof Error ? err.message : "Failed to register as volunteer",
        );
        setState(MatchingState.Error);
        throw err;
      }
    },
    [startPolling, setupRoomMembershipListener],
  );

  // Unregister as volunteer
  const unregisterAsVolunteer = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.unregisterAsVolunteer();
      setState(MatchingState.Idle);
      setMatchResult(null);
      stopPolling();
      cleanupRoomMembershipListener();
      logger.info("Unregistered as volunteer");
    } catch (err) {
      logger.error("Failed to unregister as volunteer", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to unregister as volunteer",
      );
    }
  }, [stopPolling, cleanupRoomMembershipListener]);

  // Mark as busy
  const markAsBusy = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.updateVolunteerStatus(VolunteerStatus.Busy);
      logger.info("Marked as busy");
    } catch (err) {
      logger.error("Failed to mark as busy", err);
    }
  }, []);

  // Mark as available
  const markAsAvailable = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.updateVolunteerStatus(
        VolunteerStatus.Available,
      );
      logger.info("Marked as available");
    } catch (err) {
      logger.error("Failed to mark as available", err);
    }
  }, []);

  // Request help
  const requestHelp = useCallback(
    async (language: string) => {
      if (!serviceRef.current) {
        throw new Error("Matching service not initialized");
      }

      try {
        setState(MatchingState.SearchingForVolunteer);
        setError(null);

        const result = await serviceRef.current.requestHelp(language);

        if (result.success) {
          setState(MatchingState.Matched);
          setMatchResult(result);
          logger.info("Successfully matched with volunteer");
        } else {
          setState(MatchingState.Error);
          setError(result.error || "Failed to find volunteer");
          setMatchResult(result);
        }
      } catch (err) {
        logger.error("Failed to request help", err);
        setError(
          err instanceof Error ? err.message : "Failed to request help",
        );
        setState(MatchingState.Error);
      }
    },
    [],
  );

  // Cancel help request
  const cancelHelpRequest = useCallback(() => {
    setState(MatchingState.Idle);
    setMatchResult(null);
    setError(null);
  }, []);

  // Leave call
  const leaveCall = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.leaveCurrentCall();
      setState(MatchingState.Idle);
      setMatchResult(null);
      stopPolling();
      logger.info("Left call");
    } catch (err) {
      logger.error("Failed to leave call", err);
      setError(err instanceof Error ? err.message : "Failed to leave call");
    }
  }, [stopPolling]);

  return {
    state,
    error,
    matchResult,
    availableVolunteers,
    registerAsVolunteer,
    unregisterAsVolunteer,
    markAsBusy,
    markAsAvailable,
    requestHelp,
    cancelHelpRequest,
    leaveCall,
    refreshAvailableCount,
  };
}
