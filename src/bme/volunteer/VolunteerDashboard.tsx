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

  // Refresh volunteer count on mount
  useEffect(() => {
    refreshAvailableCount();
  }, [refreshAvailableCount]);

  // Navigate to call room when matched
  useEffect(() => {
    if (state === MatchingState.Matched && matchResult?.roomId) {
      logger.info(`Navigating to call room: ${matchResult.roomId}`);
      navigate(`/${matchResult.roomId}`);
    }
  }, [state, matchResult, navigate]);

  const handleStartWaiting = useCallback(async () => {
    setIsStarting(true);
    try {
      await registerAsVolunteer(language);
      logger.info("Started waiting for help requests");
    } catch (err) {
      logger.error("Failed to start waiting", err);
    } finally {
      setIsStarting(false);
    }
  }, [registerAsVolunteer, language]);

  const handleStopWaiting = useCallback(async () => {
    try {
      await unregisterAsVolunteer();
      logger.info("Stopped waiting for help requests");
    } catch (err) {
      logger.error("Failed to stop waiting", err);
    }
  }, [unregisterAsVolunteer]);

  // Show waiting view if already waiting
  if (state === MatchingState.WaitingAsVolunteer) {
    return (
      <VolunteerWaitingView
        onStopWaiting={handleStopWaiting}
        availableVolunteers={availableVolunteers}
        stats={stats}
      />
    );
  }

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
            disabled={isStarting || state === MatchingState.Initializing}
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
        </div>
      </div>
    </div>
  );
};
