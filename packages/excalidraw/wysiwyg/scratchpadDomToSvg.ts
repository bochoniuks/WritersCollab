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

export const generateScratchpadCanvas = async (
  element: ExcalidrawScratchpadElement,
): Promise<HTMLCanvasElement> => {
    console.log("Generating...")
  const cached = element.canvasCache;
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
    left: "0",
    top: "0",
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

    const result = await html2canvas(wrapper, 
        { backgroundColor: null,
        useCORS: true,      // handle external fonts or images
    });

//   const canvas = document.createElement("canvas");
//   canvas.width = size.width;
//   canvas.height = size.height;
//   canvas.getContext("2d", { willReadFrequently: true });

//   const result = await html2canvas(wrapper, {
//     backgroundColor: null,
//     useCORS: true,
//     canvas,
//   });
    console.log(wrapper)
    // wrapper.remove();
    console.log(result)
    element.canvasCache = result;
    return result;
};

export const getCachedScratchpadCanvas = (
  element: ExcalidrawScratchpadElement,
): HTMLCanvasElement | null => element.canvasCache instanceof HTMLCanvasElement ? element.canvasCache : null;

export const invalidateScratchpadCanvas = (
  element: ExcalidrawScratchpadElement,
) => {
  element.canvasCache = null;
};
