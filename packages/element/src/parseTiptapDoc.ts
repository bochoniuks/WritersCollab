// packages/element/src/parseTiptapDoc.ts
import { COLOR_PALETTE, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, FONT_FAMILY, getFontString, getLineHeight } from "@excalidraw/common";

import type { FontFamilyValues } from "@excalidraw/element/types";

import type { JSONContent, Mark } from "@tiptap/core";
import { measureText } from "./textMeasurements";
import { parseTokens } from "./textWrapping";

export type TiptapSegment = | {
  type: "text";
  text: string;
  fontFamily: FontFamilyValues; // use numeric font-family values
  fontSize: number;
  color: string;
  fontWeight?: string; // e.g. "bold"
  fontStyle?: string;  // e.g. "italic"
  strike?: boolean;
}
| {
  type: "hardBreak";
  fontFamily: FontFamilyValues; // use numeric font-family values
  fontSize: number;
};

export type TiptapLine = TiptapSegment[];


export const wrapTiptapDoc = (
  doc: JSONContent,
  maxWidth: number,
  opts: { fontFamily?: FontFamilyValues; fontSize?: number; color?: string } = {},
) => {
  const lines = parseTiptapDoc(doc, opts);
  const result: JSONContent = { type: "doc", content: [] };
  const newParagraph = () => ({ type: "paragraph", content: [] as JSONContent[] });

  let current = newParagraph();
  let width = 0;

  for (const line of lines) {
    for (const seg of line) {
      if (seg.type === "hardBreak") {
        current.content!.push({ type: "hardBreak" });
        width = 0;
        continue;
      }
      
      const tokens = parseTokens(seg.text);
      for (const token of tokens) {
        const font = getFontString({
          fontFamily: seg.fontFamily,
          fontSize: seg.fontSize,
          fontWeight: seg.fontWeight,
          fontStyle: seg.fontStyle,
        });
        
        
        const fontName =
          Object.entries(FONT_FAMILY).find(([, id]) => id === seg.fontFamily)?.[0] ??
          "Excalifont";
          
        const marks:JSONContent = [
            {
              type: "textStyle",
              attrs: {
                fontFamily: fontName,
                fontSize: `${seg.fontSize}px`,
                color: seg.color,
              },
            },
          ]

        if (seg.fontWeight === "bold") {
          marks.push({ type: "bold" });
        }
        if (seg.fontStyle === "italic") {
          marks.push({ type: "italic" });
        }
        if (seg.strike) {
          marks.push({ type: "strike" });
        }
        
        const w = measureText(token, font, getLineHeight(seg.fontFamily)).width;

        if (width && width + w > maxWidth) {
          current.content!.push({ type: "hardBreak", marks: marks as Mark[] });
          width = 0;
        }

        current.content!.push({
          type: "text",
          text: token,
          marks: marks as Mark[],
        });

        width += w;
      }
    }

    result.content!.push(current);
    current = newParagraph();
    width = 0;
  }

  return result;
};

export const scaleTiptapDoc = (
  doc: JSONContent,
  factor: number,
): JSONContent => {
  const visit = (node: JSONContent): JSONContent => {
    const newNode: JSONContent = { ...node };

    if (Array.isArray(newNode.marks)) {
      newNode.marks = newNode.marks.map((mark) => {
        if (mark.type === "textStyle" && mark.attrs?.fontSize) {
          const size = parseFloat(mark.attrs.fontSize);
          return {
            ...mark,
            attrs: { ...mark.attrs, fontSize: `${size * factor}px` },
          };
        }
        return mark;
      });
    }

    if (Array.isArray(newNode.content)) {
      newNode.content = newNode.content.map(visit);
    }
    return newNode;
  };

  return visit(doc);
};


export const measureTiptapDocWithWidth = (
  doc: JSONContent,
  maxWidth: number,
  opts: { fontFamily?: FontFamilyValues; fontSize?: number; color?: string } = {},
) => measureTiptapDoc(wrapTiptapDoc(doc, maxWidth, opts), opts);

export const measureTiptapDoc = (
    doc: JSONContent,
    opts: { fontFamily?: FontFamilyValues; fontSize?: number; color?: string } = {}) => {
        const defaultFontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
        const defaultFontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;

  const lines = parseTiptapDoc(doc, opts);

  if (lines.length === 0 || (lines.length === 1 && lines[0].length === 0)) {
    // empty document → minimal line height
    const metrics = measureText(
      "",
      getFontString({ fontFamily: defaultFontFamily, fontSize: defaultFontSize }),
      getLineHeight(defaultFontFamily),
    );
    return { width: metrics.width, height: metrics.height };
  }

  let width = 0;
  let height = 0;
  for (const line of lines) {
    let lineWidth = 0;
    let lineHeight = 0;
    const isBreakLine =
        line.length === 0 || line.every((seg) => seg.type === "hardBreak");

    if (isBreakLine) {
      if (line.length > 0) {
        for (const seg of line) {
          const metrics = measureText(
            "",
            getFontString({ fontFamily: seg.fontFamily, fontSize: seg.fontSize }),
            getLineHeight(seg.fontFamily),
          );
          lineHeight = Math.max(lineHeight, metrics.height);
        }
      } else {
        const metrics = measureText(
          "",
          getFontString({ fontFamily: defaultFontFamily, fontSize: defaultFontSize }),
          getLineHeight(defaultFontFamily),
        );
        lineHeight = metrics.height;
      }
    } else {
      for (const seg of line) {
        if (seg.type === "hardBreak") {
          continue; // contributes no width/height
        }
        const font = getFontString({ fontFamily: seg.fontFamily, fontSize: seg.fontSize });
        const metrics = measureText(seg.text, font, getLineHeight(seg.fontFamily));
        lineWidth += metrics.width;
        lineHeight = Math.max(lineHeight, metrics.height);
      }
    }
    width = Math.max(width, lineWidth);
    height += lineHeight;
  }
  return { width, height };
};

const parseFontFamily = (value: string): FontFamilyValues => {
  const firstName = value.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  if (firstName in FONT_FAMILY) {
    return FONT_FAMILY[firstName as keyof typeof FONT_FAMILY];
  }
  const num = parseInt(value, 10);
  if (!Number.isNaN(num)) {
    return num as FontFamilyValues;
  }
  return DEFAULT_FONT_FAMILY;
};


/**
 * Traverses a Tiptap JSON document and flattens it into
 * an array of text segments with styling information.
 */
export const parseTiptapDoc = (
    doc: JSONContent,
    opts: { fontFamily?: FontFamilyValues; fontSize?: number; color?: string } = {},
    ): TiptapLine[] => {
    const defaultFontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
    const defaultFontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
    const defaultColor = opts.color ?? COLOR_PALETTE.black;
  
    const lines: TiptapLine[] = [];
    let current: TiptapLine = [];

  const pushLine = () => {
    // if (current.length) {
      lines.push(current);
      current = [];
    // }
  };

  const visit = (
    node: JSONContent,
    style: {
      fontFamily?: FontFamilyValues;
      fontSize?: number;
      color?: string;
      fontWeight?: string;
      fontStyle?: string;
      strike?: boolean;
    } = {},
  ) => {
    if (!node) {
      return;
    }
    if (node.marks) {
      node.marks.forEach((mark) => {
        if (mark.type === "textStyle" && mark.attrs) {
          if (mark.attrs.fontFamily) {
            style.fontFamily = parseFontFamily(mark.attrs.fontFamily);
          }
          if (mark.attrs.fontSize) {
            style.fontSize = parseFloat(mark.attrs.fontSize);
          }
          if (mark.attrs.color) {
            style.color = mark.attrs.color;
          }
          if (mark.attrs.fontWeight) {
            style.fontWeight = mark.attrs.fontWeight;
          }
          if (mark.attrs.fontStyle) {
            style.fontStyle = mark.attrs.fontStyle;
          }
        }
        if (mark.type === "bold") {
          style.fontWeight = "bold";
        }
        if (mark.type === "italic") {
          style.fontStyle = "italic";
        }
        if (mark.type === "strike") {
          style.strike = true;
        }
        if (mark.type === "color" && mark.attrs?.color) {
          style.color = mark.attrs.color;
        }
      });
    }
    
   
    if (node.type === "text") {
        current.push({
          type: "text",
          text: node.text ?? "",
          fontFamily: style.fontFamily || defaultFontFamily,
          fontSize: style.fontSize || defaultFontSize,
          color: style.color || defaultColor,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          strike: style.strike,
        });
    } else if (node.type === "hardBreak") {   
        current.push({
          type: "hardBreak",
          fontFamily: style.fontFamily || defaultFontFamily,
          fontSize: style.fontSize || defaultFontSize,
        });
        pushLine();
    } else if(node.type === "paragraph" && (node.content?.length ?? 0) === 0){
        current.push({ type: "hardBreak",
          fontFamily: style.fontFamily || defaultFontFamily,
          fontSize: style.fontSize || defaultFontSize, });
        pushLine();
    }

    if (Array.isArray(node.content)) {
      if (node.type === "paragraph" && node.content.length === 0) {
        // ensure blank paragraphs become blank lines
        current.push({ type: "hardBreak",
          fontFamily: style.fontFamily || defaultFontFamily,
          fontSize: style.fontSize || defaultFontSize, });
        pushLine();
      } else {
        node.content.forEach((child, idx) => {
          visit({ ...child }, { ...style });
          if (node.type === "paragraph" && idx === node.content!.length - 1) {
            pushLine();
          }
        });
      }
    }
  };

  visit(doc);
  return lines;
};

export const findBreakOffsetForHeight = (
  paragraph: JSONContent,
  maxWidth: number,
  remainingHeight: number,
  opts: { fontFamily?: FontFamilyValues; fontSize?: number; color?: string } = {},
): number => {
  // Reuse existing wrapping so we mirror browser line breaks
  const wrapped = wrapTiptapDoc(paragraph, maxWidth, opts);
  const lines = parseTiptapDoc(wrapped, opts);
  console.log(wrapped)

  let height = 0;
  let offset = 0;

  for (const line of lines) {
    let lineHeight = 0;
    for (const seg of line) {
      if (seg.type === "hardBreak") {
        continue;
      }
      const font = getFontString({
        fontFamily: seg.fontFamily,
        fontSize: seg.fontSize,
      });
      const metrics = measureText(seg.text, font, getLineHeight(seg.fontFamily));
      lineHeight = Math.max(lineHeight, metrics.height);
      offset += seg.text.length;
    }

    // if the next line would exceed available height, stop before it
    if (height + lineHeight > remainingHeight) {
      return offset;
    }

    height += lineHeight;
    // count the hard break inserted by wrapTiptapDoc
    offset += 1;
  }

  return offset;
};