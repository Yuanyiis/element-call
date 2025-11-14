/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useMemo } from "react";
import { UserRole } from "../types";

/**
 * Hook to get camera constraints based on user role
 */
export function useCameraConstraints(role: UserRole): MediaStreamConstraints {
  return useMemo(() => {
    if (role === UserRole.VisuallyImpaired) {
      // Visually impaired users: rear camera, high quality
      return {
        video: {
          facingMode: { ideal: "environment" }, // Rear camera
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      };
    } else if (role === UserRole.Volunteer) {
      // Volunteers: no camera by default, audio only
      return {
        video: false,
        audio: true,
      };
    }

    // Default: front camera, standard quality
    return {
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: true,
    };
  }, [role]);
}

/**
 * Check if device supports rear camera
 */
export async function hasRearCamera(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");

    // Check if there are multiple cameras (usually means front + rear)
    return videoDevices.length > 1;
  } catch (error) {
    console.error("Failed to check for rear camera", error);
    return false;
  }
}

/**
 * Get list of available cameras
 */
export async function getAvailableCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  } catch (error) {
    console.error("Failed to get available cameras", error);
    return [];
  }
}
