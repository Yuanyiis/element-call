/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Heading, Text } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/lib/logger";

import { useRoleContext } from "../RoleContext";
import { useMatchingContext } from "../matching";
import { MatchingState } from "../matching/useMatching";
import { Header, HeaderLogo, LeftNav, RightNav } from "../../Header";
import { UserMenuContainer } from "../../UserMenuContainer";
import { useAutoGuestLogin } from "../useAutoGuestLogin";
import { VolunteerWaitingView } from "./VolunteerWaitingView";
import { DebugPanel } from "../DebugPanel";
import { Config } from "../../config/Config";
import styles from "./VolunteerDashboard.module.css";

/**
 * Volunteer dashboard - main interface for volunteers
 */
export const VolunteerDashboard: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, stats } = useRoleContext();
  const { isLoggingIn, error: loginError } = useAutoGuestLogin();
  const {
    state,
    error,
    matchResult,
    registerAsVolunteer,
    unregisterAsVolunteer,
    availableVolunteers,
    refreshAvailableCount,
  } = useMatchingContext();

  const [isStarting, setIsStarting] = useState(false);
  const [micPermission, setMicPermission] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const [showDebug, setShowDebug] = useState(false);

  // Check microphone permission
  useEffect(() => {
    const checkPermission = async (): Promise<void> => {
      try {
        const result = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        setMicPermission(result.state as "granted" | "denied" | "prompt");

        result.addEventListener("change", () => {
          setMicPermission(result.state as "granted" | "denied" | "prompt");
        });
      } catch (err) {
        logger.warn("Failed to check microphone permission", err);
      }
    };

    checkPermission();
  }, []);

  // Refresh volunteer count on mount
  useEffect(() => {
    refreshAvailableCount();
  }, [refreshAvailableCount]);

  // Navigate to call room when registered as volunteer or matched with help seeker
  useEffect(() => {
    if (state === MatchingState.WaitingAsVolunteer && matchResult?.roomId) {
      // Volunteer should enter their call room and start the call
      // Use skipLobby=true to automatically start the call without showing lobby
      // IMPORTANT: Include viaServers parameter so Element Call can find the room
      const serverName = Config.defaultServerName() || "call.fst.gs";
      logger.info(`Volunteer registered. Navigating to call room: ${matchResult.roomId} via ${serverName}`);
      navigate(`/${matchResult.roomId}?skipLobby=true&viaServers=${serverName}`);
    } else if (state === MatchingState.Matched && matchResult?.roomId) {
      // Also handle being matched (this may not be needed for volunteers)
      const serverName = Config.defaultServerName() || "call.fst.gs";
      logger.info(`Matched! Navigating to call room: ${matchResult.roomId} via ${serverName}`);
      navigate(`/${matchResult.roomId}?skipLobby=true&viaServers=${serverName}`);
    }
  }, [state, matchResult, navigate]);

  const handleStartWaiting = useCallback(async () => {
    setIsStarting(true);
    try {
      // Request microphone permission first
      if (micPermission !== "granted") {
        logger.info("Requesting microphone permission...");
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicPermission("granted");
          logger.info("Microphone permission granted");
        } catch (err) {
          logger.error("Failed to get microphone permission", err);
          setMicPermission("denied");
          return;
        }
      }

      await registerAsVolunteer(language);
      logger.info("Started waiting for help requests");
    } catch (err) {
      logger.error("Failed to start waiting", err);
    } finally {
      setIsStarting(false);
    }
  }, [registerAsVolunteer, language, micPermission]);

  const handleStopWaiting = useCallback(async () => {
    try {
      await unregisterAsVolunteer();
      logger.info("Stopped waiting for help requests");
    } catch (err) {
      logger.error("Failed to stop waiting", err);
    }
  }, [unregisterAsVolunteer]);

  // Note: Volunteers now navigate directly to their call room when registered
  // The VolunteerWaitingView is no longer used - volunteers wait in the call room

  // Calculate hours from total duration
  const totalHours = Math.floor(stats.totalDuration / 3600);

  // Show loading state while logging in
  if (isLoggingIn) {
    return (
      <div className={styles.container}>
        <Header>
          <LeftNav>
            <HeaderLogo />
          </LeftNav>
          <RightNav>
            <UserMenuContainer />
          </RightNav>
        </Header>
        <div className={styles.content}>
          <div className={styles.header}>
            <Heading size="lg" weight="semibold">
              {t("common.loading", "Loading...")}
            </Heading>
            <Text className={styles.subtitle}>
              {t("bme.volunteer.preparing", "Preparing your volunteer session...")}
            </Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header>
        <LeftNav>
          <HeaderLogo />
        </LeftNav>
        <RightNav>
          <UserMenuContainer />
        </RightNav>
      </Header>

      <div className={styles.content}>
        <div className={styles.header}>
          <Heading size="lg" weight="semibold">
            {t("bme.volunteer.dashboard_title", "Volunteer Dashboard")}
          </Heading>
          <Text className={styles.subtitle}>
            {t(
              "bme.volunteer.subtitle",
              "Help visually impaired people by describing what you see",
            )}
          </Text>
        </div>

        {micPermission === "denied" && (
          <div className={styles.warning}>
            <div className={styles.warningIcon}>🎤</div>
            <Heading size="sm" weight="semibold">
              {t("bme.volunteer.mic_permission", "Microphone access required")}
            </Heading>
            <Text size="sm">
              {t(
                "bme.volunteer.mic_permission_desc",
                "Please allow microphone access to help people",
              )}
            </Text>
          </div>
        )}

        {(error || loginError) && (
          <div className={styles.error}>
            <Text>{error || loginError}</Text>
          </div>
        )}

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <Text size="sm" className={styles.statLabel}>
              {t("bme.stats.calls_today", "Calls today")}
            </Text>
            <Heading size="md" className={styles.statValue}>
              {stats.callsToday}
            </Heading>
          </div>

          <div className={styles.statCard}>
            <Text size="sm" className={styles.statLabel}>
              {t("bme.stats.total_calls", "Total calls")}
            </Text>
            <Heading size="md" className={styles.statValue}>
              {stats.totalCalls}
            </Heading>
          </div>

          <div className={styles.statCard}>
            <Text size="sm" className={styles.statLabel}>
              {t("bme.stats.total_time", "Total time helped")}
            </Text>
            <Heading size="md" className={styles.statValue}>
              {totalHours}h
            </Heading>
          </div>

          {stats.averageRating !== undefined && (
            <div className={styles.statCard}>
              <Text size="sm" className={styles.statLabel}>
                {t("bme.stats.average_rating", "Average rating")}
              </Text>
              <Heading size="md" className={styles.statValue}>
                {stats.averageRating.toFixed(1)} ⭐
              </Heading>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            size="lg"
            onClick={handleStartWaiting}
            disabled={
              isStarting ||
              state === MatchingState.Initializing ||
              micPermission === "denied"
            }
            className={styles.startButton}
          >
            {isStarting || state === MatchingState.Initializing
              ? t("common.loading", "Loading...")
              : t(
                  "bme.volunteer.start_waiting",
                  "Start waiting for requests",
                )}
          </Button>
        </div>

        <div className={styles.info}>
          <Text size="sm" className={styles.infoText}>
            {t(
              "bme.volunteer.online_volunteers",
              "Currently online volunteers: {{count}}",
              { count: availableVolunteers },
            )}
          </Text>
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              marginTop: "15px",
              padding: "8px 16px",
              fontSize: "12px",
              cursor: "pointer",
              backgroundColor: "#444",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
            }}
          >
            🐛 {showDebug ? "Hide" : "Show"} Debug Panel
          </button>
        </div>
      </div>

      {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}
    </div>
  );
};
