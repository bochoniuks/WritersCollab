import satori from "satori";
import { html as htmlToReact } from "satori-html";
import { SCRATCHPAD_PAGE_SIZES } from "@excalidraw/common";
import type { ExcalidrawScratchpadElement } from "@excalidraw/element/types";
import { Editor } from "@tiptap/core";
import { loadHTMLImageElement } from "@excalidraw/element";
import { DataURL } from "../types";
import { createScratchpadContainer, getScratchpadExtensions } from "./scratchpadEditor";
import { ReactNode } from "react";

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

  const wrapper = createScratchpadContainer(element);
  const editorDiv = document.createElement("div");
  editorDiv.classList.add("tiptap");          // TipTap root to receive ProseMirror class
  editorDiv.classList.add("ProseMirror");          // TipTap root to receive ProseMirror class
  wrapper.appendChild(editorDiv);
  Object.assign(wrapper.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    width: `${size.width}px`,
    height: `${size.height}px`,
    zIndex: -10
  });

  const firstPageDoc =
    element.tiptapDoc.content && element.tiptapDoc.content.length > 0
      ? { ...element.tiptapDoc, content: [element.tiptapDoc.content[0]] }
      : element.tiptapDoc;

  const editor = new Editor({
    extensions: getScratchpadExtensions(element, { maxPages: 1 }),
    content: firstPageDoc,
  });

    editorDiv.innerHTML = editor.getHTML();
    
    const container =
      document.querySelector<HTMLDivElement>(".excalidraw-textEditorContainer") ??
      document.body;
    container.appendChild(wrapper);
    
        // Wait for fonts to finish loading and two animation frames
    await (document.fonts?.ready ?? Promise.resolve());
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    // 
    // const canvas = (element.canvasCache instanceof HTMLCanvasElement) ? element.canvasCache : document.createElement("canvas");
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;

    // Convert wrapper DOM to a React‑like tree and render SVG with satori
    const reactTree = htmlToReact(wrapper.innerHTML) as ReactNode;
    const svgMarkup = await satori(reactTree, {
      width: size.width,
      height: size.height,
      fonts: [
        {
          name: "Virgil",
          data: await fetch("/fonts/Virgil.woff2").then(r => r.arrayBuffer()),
          weight: 400,
          style: "normal",
        },
        // add additional fonts if the scratchpad uses them
      ],
    });

    // Draw the SVG on a canvas
    const svgUrl = "data:image/svg+xml;base64," + btoa(svgMarkup);
    const img = new Image();
    img.src = svgUrl;
    await img.decode();
    canvas.getContext("2d")!.drawImage(img, 0, 0);

    editor.destroy();
    wrapper.remove();
    element.canvasCache = canvas;
    element.canvasSnapshot = canvas.toDataURL();

    return canvas;
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
