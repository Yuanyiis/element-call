/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useState, useCallback, useEffect } from "react";
import { logger } from "matrix-js-sdk/lib/logger";

/**
 * Hook for controlling camera flashlight/torch
 * Note: This uses the experimental ImageCapture API which may not be available on all browsers
 */
export function useFlashlight(videoTrack: MediaStreamTrack | null) {
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [imageCapture, setImageCapture] = useState<ImageCapture | null>(null);

  // Check if flashlight is supported
  useEffect(() => {
    if (!videoTrack) {
      setIsSupported(false);
      return;
    }

    try {
      // Check if ImageCapture API is available
      if (typeof ImageCapture === "undefined") {
        logger.info("ImageCapture API not supported");
        setIsSupported(false);
        return;
      }

      const capture = new ImageCapture(videoTrack);
      setImageCapture(capture);

      // Check if torch is supported
      capture
        .getPhotoCapabilities()
        .then((capabilities) => {
          const torchSupported =
            capabilities.fillLightMode &&
            capabilities.fillLightMode.includes("flash");
          setIsSupported(!!torchSupported);
          logger.info(`Flashlight supported: ${torchSupported}`);
        })
        .catch((err) => {
          logger.warn("Failed to check flashlight capabilities", err);
          setIsSupported(false);
        });
    } catch (error) {
      logger.warn("Failed to initialize ImageCapture", error);
      setIsSupported(false);
    }
  }, [videoTrack]);

  // Toggle flashlight
  const toggleFlashlight = useCallback(async (): Promise<void> => {
    if (!videoTrack || !isSupported) {
      logger.warn("Cannot toggle flashlight - not supported");
      return;
    }

    try {
      const newState = !isFlashlightOn;

      // Try using track constraints (newer API)
      if ("applyConstraints" in videoTrack) {
        await videoTrack.applyConstraints({
          // @ts-ignore - torch is not in standard types yet
          advanced: [{ torch: newState }],
        });
        setIsFlashlightOn(newState);
        logger.info(`Flashlight ${newState ? "on" : "off"}`);
      }
    } catch (error) {
      logger.error("Failed to toggle flashlight", error);
      throw error;
    }
  }, [videoTrack, isFlashlightOn, isSupported]);

  return {
    isFlashlightOn,
    toggleFlashlight,
    isSupported,
  };
}
