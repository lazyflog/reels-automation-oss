"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserSettings {
  // 자막 설정
  subtitleColor: string;
  subtitleBgColor: string | null;
  subtitleBgEnabled: boolean;
  subtitleFont: string;   // 폰트 절대경로

  // 목소리 설정
  voiceId: string;
  voiceVolume: number;  // 0.0~2.0, 기본 1.0

  // BGM 설정
  bgmFilename: string | null;
  bgmVolume: number;  // 0.0~1.0, 기본 0.25

  // 표지 설정
  coverFont: string;    // 폰트 절대경로

  // TTS 속도
  ttsSpeed: number;  // 0.7~1.5, 기본 1.1

  // 자막 테두리
  subtitleStrokeColor: string;
  subtitleStrokeWidth: number;

  // 자막 그림자
  subtitleShadowColor: string;
  subtitleShadowOffset: number;
  subtitleShadowBlur: number;

  // 자막 위치
  subtitlePosition: string;

  // 자막 폰트 크기 + 볼드 + 기울이기
  subtitleFontSize: number;
  subtitleBold: boolean;
  subtitleItalic: boolean;

  // 페르소나 (empty = no persona)
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
      // localStorage 접근 실패 시 기본값 사용
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
