/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@vector-im/compound-web";

import { useCameraSwitcher } from "./useCameraSwitcher";
import { useFlashlight } from "./useFlashlight";
import styles from "./CameraControls.module.css";

interface Props {
  videoTrack: MediaStreamTrack | null;
  onCameraSwitch?: () => void;
}

/**
 * Camera control buttons for video calls
 * Provides camera switching and flashlight toggle
 */
export const CameraControls: FC<Props> = ({ videoTrack, onCameraSwitch }) => {
  const { t } = useTranslation();

  const { switchCamera, canSwitch, isFrontCamera } = useCameraSwitcher(videoTrack);
  const { isFlashlightOn, toggleFlashlight, isSupported: isFlashlightSupported } =
    useFlashlight(videoTrack);

  const handleSwitchCamera = async (): Promise<void> => {
    await switchCamera();
    onCameraSwitch?.();
  };

  return (
    <div className={styles.controls}>
      {canSwitch && (
        <Button
          kind="secondary"
          size="sm"
          onClick={handleSwitchCamera}
          className={styles.controlButton}
          aria-label={t("bme.help.switch_camera", "Switch camera")}
        >
          <span className={styles.icon}>🔄</span>
          {t(
            isFrontCamera ? "bme.camera.to_rear" : "bme.camera.to_front",
            isFrontCamera ? "Rear Camera" : "Front Camera",
          )}
        </Button>
      )}

      {isFlashlightSupported && (
        <Button
          kind={isFlashlightOn ? "primary" : "secondary"}
          size="sm"
          onClick={toggleFlashlight}
          className={styles.controlButton}
          aria-label={t("bme.help.flashlight", "Flashlight")}
          aria-pressed={isFlashlightOn}
        >
          <span className={styles.icon}>{isFlashlightOn ? "🔦" : "🔦"}</span>
          {t(
            isFlashlightOn ? "bme.camera.flash_off" : "bme.camera.flash_on",
            isFlashlightOn ? "Flash Off" : "Flash On",
          )}
        </Button>
      )}
    </div>
  );
};
