/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useEffect, useState, useRef } from "react";
import { logger } from "matrix-js-sdk/lib/logger";

import { Config } from "../config/Config";
import { useClientLegacy } from "../ClientContext";
import { initClient } from "../utils/matrix";
import type { Session } from "../ClientContext";

/**
 * Hook that automatically logs in using a demo account if not authenticated
 * This is a workaround for homeservers that don't allow guest registration
 */
export function useAutoGuestLogin(): {
  isLoggingIn: boolean;
  error: string | null;
} {
  const { authenticated, loading, setClient } = useClientLegacy();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  // Trigger auto login when component mounts if not authenticated
  useEffect(() => {
    // Only attempt once
    if (hasAttempted.current) return;

    // Wait for client context to finish loading
    if (loading) return;

    // Already authenticated, no need to login
    if (authenticated) return;

    // No setClient function available
    if (!setClient) return;

    // Mark as attempted to prevent infinite loops
    hasAttempted.current = true;
    setIsLoggingIn(true);
    setError(null);

    (async () => {
      try {
        logger.info("Starting auto login process...");

        const homeserverUrl = Config.defaultHomeserverUrl();
        if (!homeserverUrl) {
          throw new Error("No homeserver URL configured");
        }

        logger.info("Using homeserver:", homeserverUrl);

        // Generate a random demo username
        const randomId = Math.random().toString(36).substring(2, 10);
        const username = `bme_user_${randomId}`;
        const password = `temp_${Math.random().toString(36).substring(2, 15)}`;

        logger.info("Attempting passwordless registration...");

        // Try to register the user
        const response = await fetch(`${homeserverUrl}/_matrix/client/v3/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth: { type: "m.login.dummy" },
            username: username,
            password: password,
            inhibit_login: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Registration failed: ${errorData.error || response.statusText}`,
          );
        }

        const registerData = await response.json();

        logger.info("Registration successful", {
          userId: registerData.user_id,
          deviceId: registerData.device_id,
        });

        // Initialize authenticated client
        const client = await initClient(
          {
            baseUrl: homeserverUrl,
            accessToken: registerData.access_token,
            userId: registerData.user_id,
            deviceId: registerData.device_id,
            livekitServiceURL: Config.get().livekit?.livekit_service_url,
          },
          false, // Don't restore crypto state
        );

        // Start the client with minimal sync
        // Disable push rules to avoid guest access issues
        await client.startClient({
          initialSyncLimit: 10,
          // Don't fetch push rules for guest users
          disablePresence: true,
        });

        // Create session
        const session: Session = {
          user_id: registerData.user_id,
          device_id: registerData.device_id,
          access_token: registerData.access_token,
          passwordlessUser: true,
          tempPassword: password,
        };

        // Set the client in context
        setClient(client, session);

        logger.info("Auto login complete");
      } catch (err) {
        logger.error("Failed to perform auto login", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to login automatically. Please check your homeserver configuration.",
        );
      } finally {
        setIsLoggingIn(false);
      }
    })();
  }, [loading, authenticated, setClient]);

  return { isLoggingIn, error };
}
