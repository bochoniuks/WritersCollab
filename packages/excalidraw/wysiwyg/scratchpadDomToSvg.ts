import html2canvas from "html2canvas";
import { SCRATCHPAD_PAGE_SIZES, getFontString } from "@excalidraw/common";
import type { ExcalidrawScratchpadElement } from "@excalidraw/element/types";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import FontSize from "tiptap-extension-font-size";
import { StyledHardBreak } from "./styledHardBreak";
import Underline from "@tiptap/extension-underline";
import { HeightTracking } from "./heightTrackingPlugin";

const cache = new WeakMap<ExcalidrawScratchpadElement, HTMLCanvasElement>();

export const generateScratchpadCanvas = async (
  element: ExcalidrawScratchpadElement,
): Promise<HTMLCanvasElement> => {
    console.log("Generating...")
  const cached = cache.get(element);
  if (cached) {
    console.log("returning...", cached)
    return cached;
  }
  const size = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : { width: element.width, height: element.height };

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "absolute",
    left: "100px",
    top: "100px",
    width: `${size.width}px`,
    height: `${size.height}px`,
    overflow: "hidden",
    padding: `${element.margin.top}px ${element.margin.right}px ${element.margin.bottom}px ${element.margin.left}px`,
    font: getFontString({ fontFamily: element.fontFamily, fontSize: element.fontSize }),
    color: element.strokeColor,
    background: "transparent",
  });

  const editor = new Editor({
     extensions: [StarterKit.configure({ hardBreak: false }), TextStyle, Color,
     FontFamily, FontSize, StyledHardBreak, Underline, HeightTracking],
    content: element.tiptapDoc });

  wrapper.innerHTML = editor.getHTML();
  editor.destroy();
  document.body.appendChild(wrapper);

  console.log(wrapper)
  const canvas = await html2canvas(wrapper, 
    { backgroundColor: null,
    useCORS: true,      // handle external fonts or images
  });
  console.log(wrapper)
  wrapper.remove();

  cache.set(element, canvas);
  console.log(canvas)
  return canvas;
};

export const getCachedScratchpadCanvas = (
  element: ExcalidrawScratchpadElement,
): HTMLCanvasElement | null => cache.get(element) ?? null;

export const invalidateScratchpadCanvas = (
  element: ExcalidrawScratchpadElement,
) => {
  cache.delete(element);
};
