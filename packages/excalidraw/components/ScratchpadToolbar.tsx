import React from "react";
import { Island } from "./Island";
import { ToolButton } from "./ToolButton";
import { FormatBoldIcon, FormatItalicIcon, FormatStrikeIcon, FormatUnderlineIcon } from "./icons";

type ScratchpadToolbarProps = {
  style: React.CSSProperties;
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
  onBold,
  onItalic,
  onUnderline,
  onStrike,
  boldEnabled,
  italicEnabled,
  underlineEnabled,
  strikeEnabled,
}: ScratchpadToolbarProps) => {
  return (
    <Island
        padding={1}
        className="App-toolbar scratchpad-config-toolbar"
        style={{ width: "max-content", zIndex: "var(--zIndex-layerUI)", ...style }}
    >
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
