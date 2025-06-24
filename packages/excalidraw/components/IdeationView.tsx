import { isScratchpadElement } from "@excalidraw/element";
import { useApp, useExcalidrawAppState } from "./App";
import type App from "./App";
import { ElementCanvasButtons } from "./ElementCanvasButtons";
import { ElementCanvasButton } from "./MagicButton";
import { fullscreenIcon } from "./icons";
import { scratchpadWysiwyg } from "../wysiwyg/scratchpadWysiwyg";
import { useEffect, useRef } from "react";


export const IdeationView = () => {
  const appState = useExcalidrawAppState();
  const app = useApp() as unknown as App;

  if (
    appState.scratchpadViewMode !== "ideation" ||
    !appState.ideationScratchpadId
  ) {
    return null;
  }

  const el = app.scene.getElement(appState.ideationScratchpadId);
  if (!el || !isScratchpadElement(el)) {
    return null;
  }

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const cleanup = scratchpadWysiwyg({
      id: el.id,
      canvas: app.canvas,
      getViewportCoords: () => [0, 0],
      onSubmit: () => {},
      element: el,
      excalidrawContainer: app.excalidrawContainerValue.container,
      containerSelector: ".ideation-content",
      app,
      autoSelect: false,
    });
    return () => cleanup();
  }, [el]);

  return (
    <div className="ideation-view">
      <div ref={containerRef} className="ideation-content"></div>
      <ElementCanvasButtons
        element={el}
        elementsMap={app.scene.getNonDeletedElementsMap()}
      >
        <ElementCanvasButton
          title="Full mode"
          icon={fullscreenIcon}
          checked={false}
          onChange={() => {}}
        />
      </ElementCanvasButtons>
    </div>
  );
};
