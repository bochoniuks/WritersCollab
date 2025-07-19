import React from "react";
import { Island } from "./Island";
import { ToolButton } from "./ToolButton";
import { FormatBoldIcon } from "./icons";

type ScratchpadToolbarProps = {
  style: React.CSSProperties;
  onBold(): void;
  boldEnabled: boolean;
};

export const ScratchpadToolbar = ({
  style,
  onBold,
  boldEnabled,
}: ScratchpadToolbarProps) => {
  return (
    <Island
      padding={1}
      className="App-toolbar scratchpad-config-toolbar"
      style={style}
    >
      <ToolButton
        type="icon"
        aria-label="Bold"
        title="Bold"
        icon={FormatBoldIcon}
        selected={boldEnabled}
        onClick={onBold}
      />
    </Island>
  );
};
