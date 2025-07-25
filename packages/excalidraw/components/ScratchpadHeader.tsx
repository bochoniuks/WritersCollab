import React from "react";
import clsx from "clsx";
import { ElementIsland } from "./ElementIsland";
import { ToolButton } from "./ToolButton";
import {
  sceneCoordsToViewportCoords,
  DEFAULT_FONT_FAMILY,
  FRAME_STYLE,
  SCRATCHPAD_HEADER_OFFSET,
  THEME_FILTER,
  getFontString,
  KEYS,
} from "@excalidraw/common";
import {
  getScratchpadTitle,
  measureText,
} from "@excalidraw/element";
import { ExcalidrawElement, ExcalidrawScratchpadElement, ExcalidrawTextElement } from "@excalidraw/element/types";
import { AppState } from "../types";
import { arrowsMaximize, arrowsMinimize } from "./icons";

interface ScratchpadHeaderProps {
  element: ExcalidrawScratchpadElement;
  appState: AppState;
  selectedCount: number;
  isSelected: boolean;
  isEditing: boolean;
  scratchpadViewMode: AppState["scratchpadViewMode"];
  ideationElementId: ExcalidrawElement["id"] | null;
  onChangeTitle: (name: string) => void;
  onStartEdit: () => void;
  onToggleView: () => void;
  onPointerDown: (ev: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (ev: React.WheelEvent<HTMLDivElement>) => void;
  viewBackground: string;
  isDarkTheme: boolean;
}

export const ScratchpadHeader = ({
  element,
  appState,
  selectedCount,
  isSelected,
  isEditing,
  scratchpadViewMode,
  ideationElementId,
  onChangeTitle,
  onStartEdit,
  onToggleView,
  onPointerDown,
  onWheel,
  viewBackground,
  isDarkTheme,
}: ScratchpadHeaderProps) => {
  const { x: vpX, y: vpY } = sceneCoordsToViewportCoords(
    { sceneX: element.x, sceneY: element.y },
    appState,
  );

  const title = getScratchpadTitle(element);
  const font = getFontString({
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: FRAME_STYLE.nameFontSize,
  });
  const labelMetrics = measureText(
    title,
    font,
    FRAME_STYLE.nameLineHeight as ExcalidrawTextElement["lineHeight"],
  );
  const headerWidth = labelMetrics.width + 36;
  const availableWidth = element.width * appState.zoom.value;
  const hideLabel = headerWidth > availableWidth * 0.8;

  const inIdeationView =
    scratchpadViewMode === "ideation" && ideationElementId === element.id;
  const showHeader =
    (selectedCount === 1 && isSelected) || isEditing || inIdeationView;

  const viewportY = vpY - appState.offsetTop;
  const editorMaxHeight = (appState.height - viewportY) / appState.zoom.value;
  const translateY =
    element.height > editorMaxHeight && appState.zoom.value !== 1
      ? (editorMaxHeight * (appState.zoom.value - 1)) / 2
      : 0;
      
  const commonStyle = {
    position: "absolute",
    bottom: `${
        appState.height +
        SCRATCHPAD_HEADER_OFFSET -
        vpY +
        appState.offsetTop -
        translateY
      }px`,
    left: `${vpX}px`,
    zIndex: "var(--zIndex-layerUI)",
  } as const;

  const ideationBtnIcon =
    inIdeationView ? arrowsMinimize : arrowsMaximize;

  const label = isEditing ? (
    <input
      autoFocus
      value={title}
      onChange={(e) => onChangeTitle(e.target.value)}
      onBlur={() => onStartEdit()}
      onKeyDown={(e) => {
        if (e.key === KEYS.ESCAPE || e.key === KEYS.ENTER) {
          onStartEdit();
        }
      }}
      style={{
        background: viewBackground,
        filter: isDarkTheme ? THEME_FILTER : "none",
        border: "none",
        boxShadow: "inset 0 0 0 1px var(--color-primary)",
      }}
      size={Math.max(title.length + 1, 20)}
    />
  ) : (
    <span className="scratchpad-label" style={{ minWidth: "20ch", display: "inline-block" }}>
      {title}
    </span>
  );

  if (!showHeader) {
    return (
      <div className="scratchpad-name" style={commonStyle}>
        {label}
      </div>
    );
  }

  return (
    <ElementIsland
      className={clsx("scratchpad-header", hideLabel && "scratchpad-header--compact")}
      padding={1}
      style={{ ...commonStyle, display: "flex", alignItems: "center", gap: "0.5rem" }}
      onDoubleClick={onStartEdit}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {!hideLabel && label}
      {!hideLabel && <div className="App-toolbar__divider" />}
      <ToolButton
        type="icon"
        icon={ideationBtnIcon}
        aria-label={inIdeationView ? "Canvas view" : "Ideation view"}
        title={inIdeationView ? "Canvas view" : "Ideation view"}
        onClick={onToggleView}
      />
    </ElementIsland>
  );
};
