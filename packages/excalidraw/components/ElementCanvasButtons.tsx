import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getElementAbsoluteCoords, getVisibleSceneBounds } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useExcalidrawAppState } from "../components/App";

import "./ElementCanvasButtons.scss";

import type { AppState } from "../types";
import { clamp } from "@excalidraw/math";

const CONTAINER_PADDING = 5;

const getContainerCoords = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);

  const topRight = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y1 },
    appState,
  );
  const bottomRight = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y2 },
    appState,
  );

  const x = topRight.x - appState.offsetLeft + 10;
  const y = topRight.y - appState.offsetTop;
  const bottom = bottomRight.y - appState.offsetTop;

  return { x, y, bottom };
};

export const ElementCanvasButtons = ({
  children,
  element,
  elementsMap,
  followScroll = false,
}: {
  children: React.ReactNode;
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  followScroll?: boolean;
}) => {
  const appState = useExcalidrawAppState();

  if (
    appState.contextMenu ||
    appState.newElement ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.openMenu ||
    appState.viewModeEnabled
  ) {
    return null;
  }

  const { x, y, bottom } = getContainerCoords(element, appState, elementsMap);

  let adjustedY = y

  if (followScroll){
    const viewportBounds = getVisibleSceneBounds(appState);
    console.log(viewportBounds)
    console.log(y, bottom )
    const desiredY = ((viewportBounds[3]-viewportBounds[1])/2)*appState.zoom.value
    adjustedY = clamp(desiredY, y, bottom);
  }
  

    
    return (
      <div
        className="excalidraw-canvas-buttons"
        style={{
          top: `${adjustedY}px`,
          left: `${x}px`,
          // width: CONTAINER_WIDTH,
          padding: CONTAINER_PADDING,
        }}
      >
        {children}
      </div>
    );
};
