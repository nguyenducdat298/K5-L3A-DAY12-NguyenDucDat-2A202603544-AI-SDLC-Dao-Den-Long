"""Deterministic seeded PRNG (Mulberry32) for reproducible simulation."""


class SeededRNG:
    """32-bit Mulberry32 PRNG independent of Python's global random module."""

    def __init__(self, seed: int) -> None:
        self._state = seed & 0xFFFFFFFF

    def next_u32(self) -> int:
        self._state = (self._state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self._state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61))) & 0xFFFFFFFF
        return (t ^ (t >> 14)) & 0xFFFFFFFF

    def random(self) -> float:
        """Return a float in [0.0, 1.0)."""
        return self.next_u32() / 4294967296.0

    def uniform(self, a: float, b: float) -> float:
        """Return a float in [a, b)."""
        return a + (b - a) * self.random()
