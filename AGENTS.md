# AGENTS.md — Đảo Đèn Lồng (Day 12 AI SDLC)

## Tech Stack & Commands
- **Runtime:** Python 3.12 via `uv` (headless uses pure Python stdlib; 3D client uses `pygame-ce` + `PyOpenGL`).
- **Install/Build:** `uv sync`
- **Run 3D Game:** `uv run python -m src.client.app`
- **Run Headless:** `uv run python -m src.headless --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]`
- **Run Tests:** `uv run python -m unittest discover -s tests -v`

## Architecture & Invariants
1. **Strict Core/View Separation:** `src/core/` MUST have zero imports from `pygame`, `OpenGL`, or any UI/audio library. Both `src/headless/` and `src/client/` call the exact same `src/core/sim.py`.
2. **Determinism:** Never use Python's global `random` or `time.time()` in `src/core/`. Always use the seeded PRNG (`src/core/rng.py`) initialized from `--seed`.
3. **Contract Alignment:** All gameplay constants live in `game.contract.json` (`tuning`). Never hardcode different values in `src/core/`.
4. **Creative Additions:** Visuals, dynamic lighting, procedural audio, and micro-narrative live strictly in `src/client/` and MUST NOT alter `src/core/` simulation state or headless JSONL output.
5. **Evidence Rule:** Never claim a test or command passed without running it and observing the actual output.
