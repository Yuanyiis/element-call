/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heading, Text } from "@vector-im/compound-web";

import { UserRole } from "./types";
import { useRoleContext } from "./RoleContext";
import { Header, HeaderLogo, LeftNav, RightNav } from "../Header";
import { UserMenuContainer } from "../UserMenuContainer";
import { DebugPanel } from "./DebugPanel";
import styles from "./RoleSelectionPage.module.css";

/**
 * Role selection page - the landing page for BME app
 * Users choose whether they are a volunteer or need help
 */
export const RoleSelectionPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setRole } = useRoleContext();
  const [showDebug, setShowDebug] = useState(false);

  const handleVolunteerClick = useCallback(() => {
    setRole(UserRole.Volunteer);
    // Navigate to volunteer dashboard
    navigate("/volunteer");
  }, [setRole, navigate]);

  const handleVisuallyImpairedClick = useCallback(() => {
    setRole(UserRole.VisuallyImpaired);
    // Navigate to help request page
    navigate("/help");
  }, [setRole, navigate]);

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
        <div className={styles.hero}>
          <Heading size="xl" weight="semibold" className={styles.title}>
            {t("bme.role_selection.title", "Be My Eyes Helper")}
          </Heading>
          <Text size="lg" className={styles.subtitle}>
            {t(
              "bme.role_selection.subtitle",
              "Connect volunteers with visually impaired people through video calls",
            )}
          </Text>
        </div>

        <div className={styles.roleCards}>
          <button
            className={`${styles.roleCard} ${styles.volunteerCard}`}
            onClick={handleVolunteerClick}
            aria-label={t(
              "bme.role_selection.volunteer_aria",
              "Become a volunteer to help visually impaired people",
            )}
          >
            <div className={styles.roleIcon} aria-hidden="true">
              🙋
            </div>
            <Heading size="md" weight="semibold" className={styles.roleTitle}>
              {t("bme.role_selection.volunteer", "I'm a Volunteer")}
            </Heading>
            <Text className={styles.roleDescription}>
              {t(
                "bme.role_selection.volunteer_desc",
                "Help visually impaired people by describing what you see through their camera",
              )}
            </Text>
          </button>

          <button
            className={`${styles.roleCard} ${styles.helpCard}`}
            onClick={handleVisuallyImpairedClick}
            aria-label={t(
              "bme.role_selection.help_aria",
              "Request help from a volunteer",
            )}
          >
            <div className={styles.roleIcon} aria-hidden="true">
              👁️
            </div>
            <Heading size="md" weight="semibold" className={styles.roleTitle}>
              {t("bme.role_selection.need_help", "I Need Help")}
            </Heading>
            <Text className={styles.roleDescription}>
              {t(
                "bme.role_selection.need_help_desc",
                "Connect with a volunteer who can help you see through video",
              )}
            </Text>
          </button>
        </div>

        <footer className={styles.footer}>
          <Text size="sm" className={styles.footerText}>
            {t(
              "bme.role_selection.privacy",
              "Your privacy is protected. All calls are encrypted.",
            )}
          </Text>
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              marginTop: "10px",
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
        </footer>
      </div>

      {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}
    </div>
  );
};
