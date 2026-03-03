/// <reference types="vite/client" />

// pixi.js v6 subpackages (bundled inside pixi.js, no separate @types)
declare module '@pixi/app' {
  export const Application: any
}
declare module '@pixi/extensions' {
  export const extensions: any
}
declare module '@pixi/ticker' {
  export const Ticker: any
  export const TickerPlugin: any
}
