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
import { loadHTMLImageElement } from "@excalidraw/element";
import { DataURL } from "../types";

export const loadCanvasFromSnapshot = async (
  element: ExcalidrawScratchpadElement,
): Promise<HTMLCanvasElement | null> => {
  if (!element.canvasSnapshot) {
    return null;
  }
  const image = await loadHTMLImageElement(element.canvasSnapshot as DataURL);
  const size = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : { width: element.width, height: element.height };
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d", { willReadFrequently: true })!.drawImage(image, 0, 0);
  element.canvasCache = canvas;
  return canvas;
};

export const generateScratchpadCanvas = async (
  element: ExcalidrawScratchpadElement,
): Promise<HTMLCanvasElement> => {
  const size = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : { width: element.width, height: element.height };

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
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
    
    const canvas = (element.canvasCache instanceof HTMLCanvasElement) ? element.canvasCache : document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;

    const result = await html2canvas(wrapper, {
        backgroundColor: null,
        useCORS: true,
        canvas,
    });
    wrapper.remove();
    element.canvasCache = result;
    element.canvasSnapshot = result.toDataURL();
    return result;
};

export const getCachedScratchpadCanvas = (
  element: ExcalidrawScratchpadElement,
): HTMLCanvasElement | null => {
  if (element.canvasCache instanceof HTMLCanvasElement) {
    return element.canvasCache;
  }
  if (element.canvasSnapshot) {
    // initialise canvasCache from saved data
    loadCanvasFromSnapshot(element);
  }
  return element.canvasCache || null;
};
