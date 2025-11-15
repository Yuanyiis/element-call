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
import { SearchingView } from "./SearchingView";
import { NoVolunteersView } from "./NoVolunteersView";
import { DebugPanel } from "../DebugPanel";
import styles from "./HelpRequestView.module.css";

/**
 * Main view for visually impaired users to request help
 */
export const HelpRequestView: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useRoleContext();
  const { isLoggingIn, error: loginError } = useAutoGuestLogin();
  const {
    state,
    error,
    matchResult,
    requestHelp,
    availableVolunteers,
    refreshAvailableCount,
  } = useMatchingContext();

  const [cameraPermission, setCameraPermission] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const [showDebug, setShowDebug] = useState(false);

  // Check camera permission
  useEffect(() => {
    const checkPermission = async (): Promise<void> => {
      try {
        const result = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        setCameraPermission(result.state as "granted" | "denied" | "prompt");

        result.addEventListener("change", () => {
          setCameraPermission(result.state as "granted" | "denied" | "prompt");
        });
      } catch (err) {
        logger.warn("Failed to check camera permission", err);
      }
    };

    checkPermission();
  }, []);

  // Refresh volunteer count on mount
  useEffect(() => {
    refreshAvailableCount();
    const interval = setInterval(refreshAvailableCount, 10000); // Every 10s
    return () => clearInterval(interval);
  }, [refreshAvailableCount]);

  // Navigate to call room when matched
  useEffect(() => {
    logger.info(`State changed: ${state}, matchResult: ${JSON.stringify(matchResult)}`);

    if (state === MatchingState.Matched && matchResult?.roomId) {
      logger.info(`Match successful! Navigating to call room: ${matchResult.roomId}`);

      // Use a slight delay to ensure state is properly set
      setTimeout(() => {
        logger.info(`Executing navigation to: /${matchResult.roomId}?skipLobby=true`);
        navigate(`/${matchResult.roomId}?skipLobby=true`);
      }, 500);
    } else if (state === MatchingState.Error) {
      logger.error(`Matching failed: ${error || matchResult?.error || "Unknown error"}`);
    }
  }, [state, matchResult, navigate, error]);

  const handleRequestHelp = useCallback(async () => {
    logger.info("handleRequestHelp called");

    // Request camera permission first with rear camera preference
    if (cameraPermission !== "granted") {
      try {
        logger.info("Requesting camera permission with rear camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" }, // Rear camera
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        // Stop the stream immediately as we just needed permission
        stream.getTracks().forEach((track) => track.stop());

        setCameraPermission("granted");
        logger.info("Camera permission granted");
      } catch (err) {
        logger.error("Failed to get camera permission", err);
        setCameraPermission("denied");
        return;
      }
    }

    try {
      logger.info(`Requesting help with language: ${language}`);
      await requestHelp(language);
      logger.info("Help request sent successfully");
    } catch (err) {
      logger.error("Failed to request help", err);
    }
  }, [requestHelp, language, cameraPermission]);

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
            <Heading size="lg" weight="semibold" className={styles.title}>
              {t("common.loading", "Loading...")}
            </Heading>
            <Text className={styles.subtitle}>
              {t("bme.help.preparing", "Preparing your session...")}
            </Text>
          </div>
        </div>
      </div>
    );
  }

  // Show searching view
  if (state === MatchingState.SearchingForVolunteer) {
    return <SearchingView availableVolunteers={availableVolunteers} />;
  }

  // Show no volunteers view if search failed
  if (state === MatchingState.Error && error?.includes("No volunteers")) {
    return <NoVolunteersView onRetry={handleRequestHelp} />;
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
          <Heading size="lg" weight="semibold" className={styles.title}>
            {t("bme.help.title", "Get Visual Assistance")}
          </Heading>
          <Text className={styles.subtitle}>
            {t(
              "bme.help.subtitle",
              "Connect with a volunteer who can help you see",
            )}
          </Text>
        </div>

        {cameraPermission === "denied" && (
          <div className={styles.warning}>
            <div className={styles.warningIcon}>📷</div>
            <Heading size="sm" weight="semibold">
              {t("bme.help.camera_permission", "Camera access required")}
            </Heading>
            <Text size="sm">
              {t(
                "bme.help.camera_permission_desc",
                "Please allow camera access to get help",
              )}
            </Text>
          </div>
        )}

        {((error && !error.includes("No volunteers")) || loginError) && (
          <div className={styles.error}>
            <Text>{error || loginError}</Text>
          </div>
        )}

        <div className={styles.mainAction}>
          <button
            className={styles.helpButton}
            onClick={handleRequestHelp}
            disabled={
              state === MatchingState.Initializing ||
              cameraPermission === "denied"
            }
            aria-label={t(
              "bme.help.find_volunteer_aria",
              "Find a volunteer to help you",
            )}
          >
            <div className={styles.helpButtonIcon}>🆘</div>
            <Heading size="xl" weight="semibold" className={styles.helpButtonText}>
              {t("bme.help.find_volunteer", "Find Volunteer")}
            </Heading>
            <Text className={styles.helpButtonHint}>
              {t("bme.help.tap_to_connect", "Tap to connect with a helper")}
            </Text>
          </button>
        </div>

        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>👥</span>
            <Text size="sm">
              {t(
                "bme.help.volunteers_available",
                "{{count}} volunteers online",
                { count: availableVolunteers },
              )}
            </Text>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>🔒</span>
            <Text size="sm">
              {t("bme.help.encrypted", "End-to-end encrypted")}
            </Text>
          </div>
        </div>

        <div className={styles.tips}>
          <Text size="sm" className={styles.tipTitle}>
            💡 {t("bme.help.tips_title", "Tips for best experience")}
          </Text>
          <ul className={styles.tipsList}>
            <li>
              <Text size="sm">
                {t(
                  "bme.help.tip_1",
                  "Point your camera at what you need help with",
                )}
              </Text>
            </li>
            <li>
              <Text size="sm">
                {t("bme.help.tip_2", "Speak clearly to describe your need")}
              </Text>
            </li>
            <li>
              <Text size="sm">
                {t("bme.help.tip_3", "Use good lighting if possible")}
              </Text>
            </li>
          </ul>
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
              width: "100%",
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
