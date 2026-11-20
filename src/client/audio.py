"""Procedural Web-free SFX using Python stdlib math + pygame.mixer."""

from __future__ import annotations

import array
import math
import pygame


class SoundBank:
    def __init__(self) -> None:
        self.enabled = False
        self._sounds: dict[str, pygame.mixer.Sound] = {}
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=512)
            self.enabled = True
            self._sounds["mote"] = self._make_chime(660.0, 0.16, 0.25)
            self._sounds["deposit"] = self._make_chime(523.25, 0.18, 0.28)
            self._sounds["lantern"] = self._make_chord([440.0, 554.37, 659.25], 0.45, 0.3)
            self._sounds["pulse"] = self._make_sweep(300.0, 780.0, 0.28, 0.3)
            self._sounds["hit"] = self._make_sweep(180.0, 70.0, 0.22, 0.35)
        except Exception:
            self.enabled = False

    @staticmethod
    def _make_chime(freq: float, dur: float, vol: float) -> pygame.mixer.Sound:
        sr = 22050
        n = int(sr * dur)
        buf = array.array("h")
        for i in range(n):
            t = i / sr
            env = math.exp(-t * 10.0)
            val = math.sin(2.0 * math.pi * freq * t) * env * vol
            buf.append(int(max(-1.0, min(1.0, val)) * 32767))
        return pygame.mixer.Sound(buffer=buf.tobytes())

    @staticmethod
    def _make_chord(freqs: list[float], dur: float, vol: float) -> pygame.mixer.Sound:
        sr = 22050
        n = int(sr * dur)
        buf = array.array("h")
        for i in range(n):
            t = i / sr
            env = math.exp(-t * 5.0)
            s = sum(math.sin(2.0 * math.pi * f * t) for f in freqs) / len(freqs)
            val = s * env * vol
            buf.append(int(max(-1.0, min(1.0, val)) * 32767))
        return pygame.mixer.Sound(buffer=buf.tobytes())

    @staticmethod
    def _make_sweep(f0: float, f1: float, dur: float, vol: float) -> pygame.mixer.Sound:
        sr = 22050
        n = int(sr * dur)
        buf = array.array("h")
        phase = 0.0
        for i in range(n):
            t = i / sr
            frac = i / max(1, n - 1)
            f = f0 + (f1 - f0) * frac
            phase += 2.0 * math.pi * f / sr
            env = 1.0 - frac
            val = math.sin(phase) * env * vol
            buf.append(int(max(-1.0, min(1.0, val)) * 32767))
        return pygame.mixer.Sound(buffer=buf.tobytes())

    def play(self, key: str) -> None:
        if self.enabled and key in self._sounds:
            self._sounds[key].play()
