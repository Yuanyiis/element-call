/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Button, Heading, Text } from "@vector-im/compound-web";

import { Header, HeaderLogo, LeftNav, RightNav } from "../../Header";
import { UserMenuContainer } from "../../UserMenuContainer";
import type { UserStats } from "../storage";
import styles from "./VolunteerWaitingView.module.css";

interface Props {
  onStopWaiting: () => void;
  availableVolunteers: number;
  stats: UserStats;
}

/**
 * View shown when volunteer is waiting for help requests
 */
export const VolunteerWaitingView: FC<Props> = ({
  onStopWaiting,
  availableVolunteers,
  stats,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <Header>
        <LeftNav>
          <HeaderLogo />
        </LeftNav>
        <RightNav>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} />
            <Text size="sm" weight="semibold">
              {t("bme.volunteer.status_online", "Online")}
            </Text>
          </div>
          <UserMenuContainer />
        </RightNav>
      </Header>

      <div className={styles.content}>
        <div className={styles.waitingAnimation}>
          <div className={styles.pulse}>
            <span className={styles.icon}>👁️</span>
          </div>
        </div>

        <Heading size="lg" weight="semibold" className={styles.title}>
          {t("bme.volunteer.waiting", "Waiting for help requests...")}
        </Heading>

        <Text className={styles.description}>
          {t(
            "bme.volunteer.waiting_description",
            "You will be automatically connected when someone needs help",
          )}
        </Text>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <Text size="sm" className={styles.statLabel}>
              {t("bme.volunteer.online_volunteers", "Currently online volunteers: {{count}}", { count: availableVolunteers })}
            </Text>
          </div>

          <div className={styles.statItem}>
            <Text size="sm" className={styles.statLabel}>
              {t(
                "bme.volunteer.helped_today",
                "You helped {{count}} people today",
                { count: stats.callsToday },
              )}
            </Text>
          </div>

          <div className={styles.statItem}>
            <Text size="sm" className={styles.statLabel}>
              {t(
                "bme.volunteer.total_helped",
                "Total people helped: {{count}}",
                { count: stats.totalCalls },
              )}
            </Text>
          </div>

          {stats.averageRating !== undefined && (
            <div className={styles.statItem}>
              <Text size="sm" className={styles.statLabel}>
                ⭐ {stats.averageRating.toFixed(1)} / 5.0
              </Text>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            kind="secondary"
            size="lg"
            onClick={onStopWaiting}
            className={styles.stopButton}
          >
            {t("bme.volunteer.stop_waiting", "Stop waiting")}
          </Button>
        </div>

        <div className={styles.tip}>
          <Text size="sm" className={styles.tipText}>
            💡 {t(
              "bme.volunteer.tip",
              "Tip: Keep this window open and you'll be notified when someone needs help",
            )}
          </Text>
        </div>
      </div>
    </div>
  );
};
