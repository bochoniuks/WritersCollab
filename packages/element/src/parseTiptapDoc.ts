// packages/element/src/parseTiptapDoc.ts
import type { JSONContent } from "@tiptap/core";
import type { FontFamilyValues } from "@excalidraw/element/types";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "@excalidraw/common";
import type { ExcalidrawTextElement } from "./types";

export type TiptapSegment = {
  text: string;
  fontFamily: FontFamilyValues;  // use numeric font-family values
  fontSize: number;
  color: string;
};

/**
 * Traverses a Tiptap JSON document and flattens it into
 * an array of text segments with styling information.
 */
export const parseTiptapDoc = (doc: JSONContent): TiptapSegment[] => {
  const segments: TiptapSegment[] = [];

  const visit = (
    node: JSONContent,
    style: { fontFamily?: FontFamilyValues; fontSize?: number; color?: string } = {},
    ) => {
    if (!node) {
      return;
    }
    // if this node stores style marks, merge them into the current style
    if (node.marks) {
      node.marks.forEach((mark) => {
        if (mark.type === "textStyle" && mark.attrs) {
          if (mark.attrs.fontFamily) {
            style.fontFamily = mark.attrs.fontFamily;
          }
          if (mark.attrs.fontSize) {
            style.fontSize = parseFloat(mark.attrs.fontSize);
          }
          if (mark.attrs.color) {
            style.color = mark.attrs.color;
          }
        }
        if (mark.type === "color" && mark.attrs?.color) {
          style.color = mark.attrs.color;
        }
      });
    }

    if (node.type === "text") {
      segments.push({
        text: node.text ?? "",
        fontFamily: style.fontFamily || DEFAULT_FONT_FAMILY,
        fontSize: style.fontSize || DEFAULT_FONT_SIZE,
        color: style.color || "black",
      });
    }

    if (Array.isArray(node.content)) {
      node.content.forEach((child) =>
        visit({ ...child }, { ...style }),
      );
    }
  };

  visit(doc);
  return segments;
};
