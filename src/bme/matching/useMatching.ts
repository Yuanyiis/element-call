/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useState, useEffect, useCallback, useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
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
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize matching service when client is available
  useEffect(() => {
    if (!client) {
      serviceRef.current = null;
      setState(MatchingState.Idle);
      return;
    }

    logger.info("[useMatching] Client available, initializing matching service...");
    setIsInitializing(true);
    setState(MatchingState.Initializing);

    const service = new MatchingService(client);

    service
      .initialize()
      .then(() => {
        serviceRef.current = service;
        setIsInitializing(false);
        setState(MatchingState.Idle);
        logger.info("[useMatching] Matching service initialized successfully");
      })
      .catch((err) => {
        logger.error("[useMatching] Failed to initialize matching service", err);
        setError("Failed to initialize matching service");
        setIsInitializing(false);
        setState(MatchingState.Error);
      });

    return () => {
      service.cleanup().catch((err) => {
        logger.error("Failed to cleanup matching service", err);
      });
    };
  }, [client]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

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

  // Register as volunteer
  const registerAsVolunteer = useCallback(
    async (language: string) => {
      try {
        setState(MatchingState.Initializing);
        setError(null);

        // Wait for service to be initialized
        logger.info("[registerAsVolunteer] Waiting for matching service...");
        const maxWaitTime = 10000; // 10 seconds
        const startTime = Date.now();

        while (!serviceRef.current && Date.now() - startTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!serviceRef.current) {
          throw new Error("Matching service failed to initialize within timeout");
        }

        logger.info("[registerAsVolunteer] Matching service ready, registering volunteer...");

        const roomId = await serviceRef.current.registerAsVolunteer(language);

        setState(MatchingState.WaitingAsVolunteer);
        setMatchResult({ success: true, roomId });

        // Start polling for stats
        startPolling();

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
    [startPolling],
  );

  // Unregister as volunteer
  const unregisterAsVolunteer = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.unregisterAsVolunteer();
      setState(MatchingState.Idle);
      setMatchResult(null);
      stopPolling();
      logger.info("Unregistered as volunteer");
    } catch (err) {
      logger.error("Failed to unregister as volunteer", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to unregister as volunteer",
      );
    }
  }, [stopPolling]);

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
      try {
        setState(MatchingState.SearchingForVolunteer);
        setError(null);

        // Wait for service to be initialized
        logger.info("[requestHelp] Waiting for matching service...");
        const maxWaitTime = 10000; // 10 seconds
        const startTime = Date.now();

        while (!serviceRef.current && Date.now() - startTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!serviceRef.current) {
          throw new Error("Matching service failed to initialize within timeout");
        }

        logger.info("[requestHelp] Matching service ready, requesting help...");

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
