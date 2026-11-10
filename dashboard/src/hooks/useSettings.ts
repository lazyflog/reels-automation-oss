"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserSettings {
  // Subtitle settings
  subtitleColor: string;
  subtitleBgColor: string | null;
  subtitleBgEnabled: boolean;
  subtitleFont: string;   // absolute font path

  // Voice settings
  voiceId: string;
  voiceVolume: number;  // 0.0–2.0, default 1.0

  // BGM settings
  bgmFilename: string | null;
  bgmVolume: number;  // 0.0–1.0, default 0.25

  // Cover settings
  coverFont: string;    // absolute font path

  // TTS speed
  ttsSpeed: number;  // 0.7–1.5, default 1.1

  // Subtitle outline
  subtitleStrokeColor: string;
  subtitleStrokeWidth: number;

  // Subtitle shadow
  subtitleShadowColor: string;
  subtitleShadowOffset: number;
  subtitleShadowBlur: number;

  // Subtitle position
  subtitlePosition: string;

  // Subtitle font size + bold + italic
  subtitleFontSize: number;
  subtitleBold: boolean;
  subtitleItalic: boolean;

  // Persona (empty = no persona)
  persona: string;
}

const STORAGE_KEY = "reels_user_settings";

const DEFAULT_FONT_PATH = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf";

const DEFAULTS: UserSettings = {
  subtitleColor: "#ffffff",
  subtitleBgColor: "#000000",
  subtitleBgEnabled: false,
  subtitleFont: DEFAULT_FONT_PATH,
  voiceId: "",
  voiceVolume: 1.0,
  bgmFilename: null,
  bgmVolume: 0.25,
  coverFont: DEFAULT_FONT_PATH,
  ttsSpeed: 1.1,
  subtitleStrokeColor: "#000000",
  subtitleStrokeWidth: 2,
  subtitleShadowColor: "#000000",
  subtitleShadowOffset: 2,
  subtitleShadowBlur: 0,
  subtitlePosition: "9",
  subtitleFontSize: 64,
  subtitleBold: true,
  subtitleItalic: false,
  persona: "",
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
      }
    } catch {
      // Fall back to defaults if localStorage is unavailable
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
