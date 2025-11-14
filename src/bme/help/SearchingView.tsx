/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Heading, Text } from "@vector-im/compound-web";

import { useMatchingContext } from "../matching";
import { Header, HeaderLogo, LeftNav, RightNav } from "../../Header";
import { UserMenuContainer } from "../../UserMenuContainer";
import styles from "./SearchingView.module.css";

interface Props {
  availableVolunteers: number;
}

/**
 * View shown while searching for an available volunteer
 */
export const SearchingView: FC<Props> = ({ availableVolunteers }) => {
  const { t } = useTranslation();
  const { cancelHelpRequest } = useMatchingContext();

  const handleCancel = useCallback(() => {
    cancelHelpRequest();
  }, [cancelHelpRequest]);

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
        <div className={styles.searchingAnimation}>
          <div className={styles.ripple}>
            <div className={styles.rippleCircle}></div>
            <div className={styles.rippleCircle}></div>
            <div className={styles.rippleCircle}></div>
          </div>
          <div className={styles.searchIcon}>🔍</div>
        </div>

        <Heading size="lg" weight="semibold" className={styles.title}>
          {t("bme.help.searching", "Searching for an available volunteer...")}
        </Heading>

        <Text className={styles.description}>
          {t(
            "bme.help.searching_description",
            "Please wait while we connect you with someone who can help",
          )}
        </Text>

        {availableVolunteers > 0 && (
          <div className={styles.info}>
            <div className={styles.infoIcon}>👥</div>
            <Text>
              {t(
                "bme.help.volunteers_searching",
                "{{count}} volunteers available",
                { count: availableVolunteers },
              )}
            </Text>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            kind="secondary"
            size="lg"
            onClick={handleCancel}
            className={styles.cancelButton}
          >
            {t("bme.help.cancel_search", "Cancel search")}
          </Button>
        </div>

        <div className={styles.tip}>
          <Text size="sm" className={styles.tipText}>
            💡 {t(
              "bme.help.searching_tip",
              "Keep your camera ready and make sure you're in a well-lit area",
            )}
          </Text>
        </div>
      </div>
    </div>
  );
};
