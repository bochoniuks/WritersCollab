import html2canvas from "html2canvas";
import { SCRATCHPAD_PAGE_SIZES, getFontString } from "@excalidraw/common";
import type { ExcalidrawScratchpadElement } from "@excalidraw/element/types";
import { Editor } from "@tiptap/core";

const cache = new WeakMap<ExcalidrawScratchpadElement, HTMLCanvasElement>();

export const generateScratchpadCanvas = async (
  element: ExcalidrawScratchpadElement,
): Promise<HTMLCanvasElement> => {
  const cached = cache.get(element);
  if (cached) {
    return cached;
  }
 
  const size = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : { width: element.width, height: element.height };

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "absolute",
    left: "-9999px",
    top: "0",
    width: `${size.width}px`,
    height: `${size.height}px`,
    overflow: "hidden",
    padding: `${element.margin.top}px ${element.margin.right}px ${element.margin.bottom}px ${element.margin.left}px`,
    font: getFontString({ fontFamily: element.fontFamily, fontSize: element.fontSize }),
    color: element.strokeColor,
    background: "transparent",
  });

  const editor = new Editor({ content: element.tiptapDoc });
  wrapper.innerHTML = editor.getHTML();
  editor.destroy();
  document.body.appendChild(wrapper);

  const canvas = await html2canvas(wrapper, { backgroundColor: null });
  wrapper.remove();

  cache.set(element, canvas);
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
