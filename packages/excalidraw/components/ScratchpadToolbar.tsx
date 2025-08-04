import React from "react";
import { Island } from "./Island";
import { ToolButton } from "./ToolButton";
import { FormatBoldIcon, FormatItalicIcon, FormatStrikeIcon, FormatUnderlineIcon } from "./icons";
import { FontPicker } from "./FontPicker/FontPicker";
import { FontFamilyValues } from "@excalidraw/element/types";

type ScratchpadToolbarProps = {
  style: React.CSSProperties;
  currentFontFamily: FontFamilyValues;
  onFontChange(font: FontFamilyValues): void;
  onBold(): void;
  onItalic(): void;
  onUnderline(): void;
  onStrike(): void;
  boldEnabled: boolean;
  italicEnabled: boolean;
  underlineEnabled: boolean;
  strikeEnabled: boolean;
};

export const ScratchpadToolbar = ({
  style,
  currentFontFamily,
  onFontChange,
  onBold,
  onItalic,
  onUnderline,
  onStrike,
  boldEnabled,
  italicEnabled,
  underlineEnabled,
  strikeEnabled,
}: ScratchpadToolbarProps) => {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [hoveredFont, setHoveredFont] = React.useState<FontFamilyValues | null>(null);
  return (
    <Island
        padding={1}
        className="App-toolbar scratchpad-config-toolbar"
        style={{ display: "flex",
        flexDirection: "column", width: "max-content", zIndex: "var(--zIndex-layerUI)", ...style }}
    >
      <FontPicker
        isOpened={pickerOpen}
        selectedFontFamily={currentFontFamily}
        hoveredFontFamily={hoveredFont}
        onSelect={onFontChange}
        onHover={setHoveredFont}
        onLeave={() => setHoveredFont(null)}
        onPopupChange={setPickerOpen}
      />
      <ToolButton
        type="icon"
        aria-label="Bold"
        title="Bold"
        icon={FormatBoldIcon}
        selected={boldEnabled}
        onClick={onBold}
      />
      <ToolButton
        type="icon"
        aria-label="Italic"
        title="Italic"
        icon={FormatItalicIcon}
        selected={italicEnabled}
        onClick={onItalic}
      />
      <ToolButton
        type="icon"
        aria-label="Underline"
        title="Underline"
        icon={FormatUnderlineIcon}
        selected={underlineEnabled}
        onClick={onUnderline}
      />
      <ToolButton
        type="icon"
        aria-label="Strikethrough"
        title="Strikethrough"
        icon={FormatStrikeIcon}
        selected={strikeEnabled}
        onClick={onStrike}
      />
    </Island>
  );
};
