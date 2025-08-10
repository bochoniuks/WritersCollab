import {
  SCRATCHPAD_PAGE_BORDER_COLOR,
  SCRATCHPAD_PAGE_GAP,
  SCRATCHPAD_PAGE_SIZES,
  getFontString,
} from "@excalidraw/common";
import type { ExcalidrawScratchpadElement } from "@excalidraw/element/types";

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import FontSize from "tiptap-extension-font-size";
import Underline from "@tiptap/extension-underline";
import { HeightTracking } from "./heightTrackingPlugin";
import { DocumentWithPages } from "./documentWithPages";
import { Page, pageConfigPlugin } from "./page";
import { PageReflow } from "./pageReflow";
import { PaginatedBulletList } from "./bulletList";
import { SelectionHighlight } from "./selectionHighlight";


/**
 * Returns the list of TipTap extensions used by a scratchpad editor.
 */
export const getScratchpadExtensions = (
  element: ExcalidrawScratchpadElement,
  options: { maxPages?: number } = {},
) => {
  const pageSize = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : { width: element.width, height: element.height };

    const pageConfig = {
        width: pageSize.width,
        height: pageSize.height,         
        margin: {
            left: element.margin.left,
            right: element.margin.right,
            top: element.margin.top,
            bottom: element.margin.bottom,
        },
    }

  return [
    pageConfigPlugin(pageConfig),
    DocumentWithPages,
    StarterKit.configure({ document: false, bulletList: false }),
    PaginatedBulletList,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Underline,
    SelectionHighlight,
    HeightTracking,
    Page,
    PageReflow.configure({
      maxPages: options.maxPages,
    }),
  ];
};

/**
 * Creates a styled container for the scratchpad editor.
 * The returned div has the same classes and CSS variables used by the
 * live scratchpad editor.
 */
export const createScratchpadContainer = (
  element: ExcalidrawScratchpadElement,
  viewMode: "ideation" | "cava" | "full" = "cava",
) => {
  const container = document.createElement("div");
  container.classList.add(
    "excalidraw-wysiwyg",
    "inherit-styles",
    "scratchpad-wysiwyg",
  );
  container.tabIndex = 0;
  container.dir = "auto";
  container.dataset.type = "wysiwyg";

  const font = getFontString({
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
  });

  Object.assign(container.style, {
    position: "relative",
    display: "inline-table",
    minHeight: "1em",
    overflowX: "hidden",
    overflowY: viewMode === "ideation" ? "visible" : "auto",
    font,
    background: "transparent",
    boxSizing: "content-box",
    zIndex: 10
  });

  const page = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : null;

  container.style.setProperty(
    "--page-padding",
    `${element.margin.top}px ${element.margin.right}px ${element.margin.bottom}px ${element.margin.left}px`,
  );
  container.style.setProperty(
    "--page-overflow",
    element.paginationEnabled || viewMode === "ideation" ? "visible" : "auto",
  );
  container.style.setProperty(
    "--page-border-color",
    SCRATCHPAD_PAGE_BORDER_COLOR,
  );
  container.style.setProperty("--page-gap", `${SCRATCHPAD_PAGE_GAP}px`);
  container.style.setProperty("--page-width", `${page?.width}px`);
  container.style.setProperty("--page-height", `${page?.height}px`);

  return container;
};
