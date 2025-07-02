import { ExcalidrawScratchpadElement } from "./types";

const DEFAULT_SCRATCHPAD_NAME = "Scratchpad";

export const getDefaultScratchpadName = () => DEFAULT_SCRATCHPAD_NAME;

export const getScratchpadTitle = (el: ExcalidrawScratchpadElement) =>
  el.name === null ? DEFAULT_SCRATCHPAD_NAME : el.name;
