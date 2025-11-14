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
import styles from "./NoVolunteersView.module.css";

interface Props {
  onRetry: () => void;
}

/**
 * View shown when no volunteers are available
 */
export const NoVolunteersView: FC<Props> = ({ onRetry }) => {
  const { t } = useTranslation();

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
        <div className={styles.illustration}>
          <span className={styles.icon}>😔</span>
        </div>

        <Heading size="lg" weight="semibold" className={styles.title}>
          {t("bme.help.no_volunteers", "No volunteers available right now")}
        </Heading>

        <Text className={styles.description}>
          {t(
            "bme.help.no_volunteers_desc",
            "Please try again later or check back soon",
          )}
        </Text>

        <div className={styles.suggestions}>
          <Text size="sm" className={styles.suggestionTitle}>
            {t("bme.help.suggestions_title", "What you can do:")}
          </Text>
          <ul className={styles.suggestionsList}>
            <li>
              <Text size="sm">
                {t(
                  "bme.help.suggestion_1",
                  "Try again in a few minutes when more volunteers might be online",
                )}
              </Text>
            </li>
            <li>
              <Text size="sm">
                {t(
                  "bme.help.suggestion_2",
                  "Peak times are usually mornings and evenings",
                )}
              </Text>
            </li>
            <li>
              <Text size="sm">
                {t(
                  "bme.help.suggestion_3",
                  "Consider bookmarking this page for quick access",
                )}
              </Text>
            </li>
          </ul>
        </div>

        <div className={styles.actions}>
          <Button
            size="lg"
            onClick={onRetry}
            className={styles.retryButton}
          >
            {t("bme.help.try_again", "Try again")}
          </Button>
        </div>

        <div className={styles.info}>
          <Text size="sm" className={styles.infoText}>
            💙 {t(
              "bme.help.volunteer_appreciation",
              "Our volunteers are amazing people helping in their free time",
            )}
          </Text>
        </div>
      </div>
    </div>
  );
};
