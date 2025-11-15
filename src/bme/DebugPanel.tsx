/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useState, useEffect } from "react";
import { logger } from "matrix-js-sdk/lib/logger";
import { useClientLegacy } from "../ClientContext";
import { useMatchingContext } from "./matching";
import { useRoleContext } from "./RoleContext";

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

/**
 * Debug panel that shows logs and state information
 * Useful when browser console is not accessible
 */
export const DebugPanel: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    // Load logs from localStorage on init
    try {
      const saved = localStorage.getItem("bme_debug_logs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const { client, authenticated } = useClientLegacy();
  const { state, matchResult, availableVolunteers } = useMatchingContext();
  const { role } = useRoleContext();

  // Save logs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("bme_debug_logs", JSON.stringify(logs));
    } catch (e) {
      console.error("Failed to save logs to localStorage:", e);
    }
  }, [logs]);

  // Intercept logger calls
  useEffect(() => {
    const originalInfo = logger.info;
    const originalError = logger.error;
    const originalWarn = logger.warn;

    logger.info = (...args: any[]) => {
      originalInfo.apply(logger, args);
      setLogs((prev) => [
        ...prev.slice(-199),
        {
          timestamp: Date.now(),
          level: "INFO",
          message: args.map((a) => String(a)).join(" "),
        },
      ]);
    };

    logger.error = (...args: any[]) => {
      originalError.apply(logger, args);
      setLogs((prev) => [
        ...prev.slice(-199),
        {
          timestamp: Date.now(),
          level: "ERROR",
          message: args.map((a) => String(a)).join(" "),
        },
      ]);
    };

    logger.warn = (...args: any[]) => {
      originalWarn.apply(logger, args);
      setLogs((prev) => [
        ...prev.slice(-199),
        {
          timestamp: Date.now(),
          level: "WARN",
          message: args.map((a) => String(a)).join(" "),
        },
      ]);
    };

    return () => {
      logger.info = originalInfo;
      logger.error = originalError;
      logger.warn = originalWarn;
    };
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const copyLogs = () => {
    const text = logs
      .map((log) => `[${formatTime(log.timestamp)}] ${log.level}: ${log.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    alert("Logs copied to clipboard!");
  };

  const clearLogs = () => {
    setLogs([]);
    try {
      localStorage.removeItem("bme_debug_logs");
    } catch (e) {
      console.error("Failed to clear logs from localStorage:", e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#1a1a1a",
        color: "#fff",
        zIndex: 10000,
        maxHeight: isExpanded ? "80vh" : "150px",
        display: "flex",
        flexDirection: "column",
        borderTop: "2px solid #333",
        fontFamily: "monospace",
        fontSize: "12px",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#2a2a2a",
        }}
      >
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <strong>🐛 Debug Panel</strong>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              backgroundColor: "#444",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
            }}
          >
            {isExpanded ? "▼ Collapse" : "▲ Expand"}
          </button>
          <button
            onClick={copyLogs}
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              backgroundColor: "#444",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
            }}
          >
            📋 Copy Logs
          </button>
          <button
            onClick={clearLogs}
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              backgroundColor: "#444",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
            }}
          >
            🗑️ Clear
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "4px 8px",
            fontSize: "11px",
            cursor: "pointer",
            backgroundColor: "#d44",
            color: "#fff",
            border: "none",
            borderRadius: "3px",
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* State Info */}
      <div
        style={{
          padding: "8px",
          borderBottom: "1px solid #333",
          backgroundColor: "#222",
          fontSize: "11px",
        }}
      >
        <strong>State:</strong> {state} | <strong>Role:</strong> {role} |{" "}
        <strong>Auth:</strong> {authenticated ? "✓ Yes" : "✗ No"} |{" "}
        <strong>User:</strong> {client?.getUserId() || "None"} |{" "}
        <strong>Available Volunteers:</strong> {availableVolunteers} |{" "}
        <strong>Match Room:</strong> {matchResult?.roomId || "None"}
      </div>

      {/* Logs */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "#888", fontStyle: "italic" }}>
            No logs yet. Logs will appear here as actions occur.
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                padding: "2px 0",
                borderBottom: "1px solid #333",
                color:
                  log.level === "ERROR"
                    ? "#ff6b6b"
                    : log.level === "WARN"
                      ? "#ffa500"
                      : "#4ade80",
              }}
            >
              <span style={{ color: "#888" }}>[{formatTime(log.timestamp)}]</span>{" "}
              <span
                style={{
                  fontWeight: "bold",
                  color:
                    log.level === "ERROR"
                      ? "#ff6b6b"
                      : log.level === "WARN"
                        ? "#ffa500"
                        : "#4ade80",
                }}
              >
                {log.level}:
              </span>{" "}
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
