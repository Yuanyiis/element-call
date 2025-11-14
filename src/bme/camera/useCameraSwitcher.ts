/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useState, useCallback, useEffect } from "react";
import { logger } from "matrix-js-sdk/lib/logger";
import { getAvailableCameras } from "./useCameraConstraints";

export type FacingMode = "user" | "environment";

/**
 * Hook for switching between front and rear cameras
 */
export function useCameraSwitcher(
  videoTrack: MediaStreamTrack | null,
) {
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [canSwitch, setCanSwitch] = useState(false);

  // Get available cameras on mount
  useEffect(() => {
    const fetchCameras = async (): Promise<void> => {
      const cameras = await getAvailableCameras();
      setAvailableCameras(cameras);
      setCanSwitch(cameras.length > 1);
    };

    fetchCameras();
  }, []);

  // Switch camera
  const switchCamera = useCallback(async (): Promise<void> => {
    if (!videoTrack || !canSwitch) {
      logger.warn("Cannot switch camera - no track or only one camera available");
      return;
    }

    const newFacingMode: FacingMode = facingMode === "user" ? "environment" : "user";

    try {
      // Get new stream with different facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false, // Don't request audio, we already have it
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace the old track
      if (videoTrack.enabled) {
        videoTrack.stop();
      }

      setFacingMode(newFacingMode);
      logger.info(`Switched camera to ${newFacingMode}`);

      return;
    } catch (error) {
      logger.error("Failed to switch camera", error);
      throw error;
    }
  }, [videoTrack, facingMode, canSwitch]);

  return {
    facingMode,
    switchCamera,
    canSwitch,
    availableCameras,
    isFrontCamera: facingMode === "user",
    isRearCamera: facingMode === "environment",
  };
}
