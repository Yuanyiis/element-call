/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useEffect, useState, useCallback } from "react";
import { createClient } from "matrix-js-sdk";
import { logger } from "matrix-js-sdk/lib/logger";

import { Config } from "../config/Config";
import { useClientLegacy } from "../ClientContext";
import { initClient } from "../utils/matrix";
import type { Session } from "../ClientContext";

/**
 * Hook that automatically logs in as a guest if not authenticated
 * Returns: { isLoggingIn: boolean, error: string | null }
 */
export function useAutoGuestLogin(): {
  isLoggingIn: boolean;
  error: string | null;
} {
  const { authenticated, loading, setClient } = useClientLegacy();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performGuestLogin = useCallback(async () => {
    if (isLoggingIn || authenticated || !setClient) return;

    setIsLoggingIn(true);
    setError(null);

    try {
      logger.info("Starting guest login process...");

      const homeserverUrl = Config.defaultHomeserverUrl();
      if (!homeserverUrl) {
        throw new Error("No homeserver URL configured");
      }

      // Create temporary client for registration
      const tempClient = createClient({ baseUrl: homeserverUrl });

      // Register as guest
      logger.info("Registering guest account...");
      const registerResponse = await tempClient.registerGuest({});

      logger.info("Guest registered successfully", {
        userId: registerResponse.user_id,
        deviceId: registerResponse.device_id,
      });

      // Initialize authenticated client
      const client = await initClient(
        {
          baseUrl: homeserverUrl,
          accessToken: registerResponse.access_token,
          userId: registerResponse.user_id,
          deviceId: registerResponse.device_id,
          livekitServiceURL: Config.get().livekit?.livekit_service_url,
        },
        false, // Don't restore crypto state for guest
      );

      // Start the client
      await client.startClient();

      // Create session
      const session: Session = {
        user_id: registerResponse.user_id,
        device_id: registerResponse.device_id,
        access_token: registerResponse.access_token,
        passwordlessUser: true, // Guest users are passwordless
      };

      // Set the client in context
      setClient(client, session);

      logger.info("Guest login complete");
    } catch (err) {
      logger.error("Failed to perform guest login", err);
      setError(
        err instanceof Error ? err.message : "Failed to login as guest",
      );
    } finally {
      setIsLoggingIn(false);
    }
  }, [authenticated, isLoggingIn, setClient]);

  // Trigger guest login when component mounts if not authenticated
  useEffect(() => {
    if (!loading && !authenticated && !isLoggingIn) {
      performGuestLogin();
    }
  }, [loading, authenticated, isLoggingIn, performGuestLogin]);

  return { isLoggingIn, error };
}
