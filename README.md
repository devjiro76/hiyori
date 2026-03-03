# Hyori - Live2D Desktop Companion

Your cute and reliable desktop assistant powered by Live2D.

A transparent, frameless macOS desktop app featuring a Live2D character that lives on your screen. Chat naturally, get desktop tasks done, and enjoy an always-present companion.

<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="Hyori icon" />
</p>

## Features

- **Live2D Character** — Expressive anime character with emotion-driven animations, gaze tracking, physics-based dragging, and idle motions
- **AI Chat** — Natural conversation via OpenAI-compatible APIs (OpenAI, Anthropic, Google, Groq, local models)
- **Desktop Agent** — Launch apps, open URLs, run shell commands, manage clipboard, send notifications — all through chat
- **Transparent Window** — Frameless, always-on-top capable, proportionally resizable
- **Emotion System** — VAD (Valence-Arousal-Dominance) emotion model that maps AI responses to Live2D expressions in real-time
- **BYOK** — Bring Your Own Key. All API keys stay local on your machine

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Tauri v2](https://v2.tauri.app/) (Rust) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| Live2D | pixi-live2d-display + PixiJS v6 |
| LLM | OpenAI-compatible chat completions API |
| Testing | Vitest |

## Prerequisites

- **Node.js** >= 18
- **pnpm**
- **Rust** (latest stable)
- **Tauri v2 CLI** — `cargo install tauri-cli --version "^2"`
- **Live2D Cubism Core SDK** — Place `live2dcubismcore.min.js` in `public/`
- **Live2D Model** — Place model files in `public/models/`

> Live2D SDK and models are proprietary and not included in this repository.

## Setup

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tauri:dev

# Build for production
pnpm tauri:build

# Run tests
pnpm test
```

## Configuration

On first launch, open Settings (`Cmd + ,`) to configure:

1. **LLM Provider** — Select your provider (OpenAI, Anthropic, Google, Groq, etc.)
2. **API Key** — Enter your API key
3. **Model** — Choose a model or use the default

## Project Structure

```
src/
├── App.tsx                     # Main app component
├── components/                 # React components
│   ├── ChatBubble.tsx          # Chat interface
│   ├── ChatHistory.tsx         # Message history
│   ├── ConfirmDialog.tsx       # Tool confirmation dialog
│   ├── Live2DViewer.tsx        # Live2D canvas
│   └── SettingsPanel.tsx       # Settings UI
├── hooks/
│   ├── useLive2D.ts            # Live2D lifecycle hook
│   └── useWindowBehavior.ts    # Window behavior hook
├── lib/
│   ├── agent/                  # Desktop agent (tools, safety, routing)
│   ├── live2d/                 # Live2D engine (emotions, gaze, physics)
│   └── llm/                    # LLM adapter and config
├── characters/                 # Character definitions
└── styles/                     # Tailwind styles

src-tauri/
├── src/
│   ├── lib.rs                  # Tauri app setup
│   └── commands.rs             # Rust IPC commands
└── Cargo.toml
```

## License

MIT
