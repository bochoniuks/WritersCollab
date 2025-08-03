import { getElementAbsoluteCoords, getVisibleElements, Scene } from "@excalidraw/element";
import {
  IDEATION_HORIZONTAL_SCROLL_FACTOR,
  IDEATION_VERTICAL_SCROLL_MARGIN_RATIO,
  MAX_ZOOM,
  MIN_ZOOM,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { getClosestElementBounds } from "@excalidraw/element";

import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppState, Offsets, PointerCoords, Zoom } from "../types";
import { getNormalizedZoom } from "./normalize";
import { clamp } from "@excalidraw/math";

const isOutsideViewPort = (appState: AppState, cords: Array<number>) => {
  const [x1, y1, x2, y2] = cords;
  const { x: viewportX1, y: viewportY1 } = sceneCoordsToViewportCoords(
    { sceneX: x1, sceneY: y1 },
    appState,
  );
  const { x: viewportX2, y: viewportY2 } = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y2 },
    appState,
  );
  return (
    viewportX2 - viewportX1 > appState.width ||
    viewportY2 - viewportY1 > appState.height
  );
};

export const centerScrollOn = ({
  scenePoint,
  viewportDimensions,
  zoom,
  offsets,
}: {
  scenePoint: PointerCoords;
  viewportDimensions: { height: number; width: number };
  zoom: Zoom;
  offsets?: Offsets;
}) => {
  let scrollX =
    (viewportDimensions.width - (offsets?.right ?? 0)) / 2 / zoom.value -
    scenePoint.x;

  scrollX += (offsets?.left ?? 0) / 2 / zoom.value;

  let scrollY =
    (viewportDimensions.height - (offsets?.bottom ?? 0)) / 2 / zoom.value -
    scenePoint.y;

  scrollY += (offsets?.top ?? 0) / 2 / zoom.value;

  return {
    scrollX,
    scrollY,
  };
};

export const calculateScrollCenter = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): { scrollX: number; scrollY: number } => {
  elements = getVisibleElements(elements);

  if (!elements.length) {
    return {
      scrollX: 0,
      scrollY: 0,
    };
  }
  let [x1, y1, x2, y2] = getCommonBounds(elements);

  if (isOutsideViewPort(appState, [x1, y1, x2, y2])) {
    [x1, y1, x2, y2] = getClosestElementBounds(
      elements,
      viewportCoordsToSceneCoords(
        { clientX: appState.scrollX, clientY: appState.scrollY },
        appState,
      ),
    );
  }

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return centerScrollOn({
    scenePoint: { x: centerX, y: centerY },
    viewportDimensions: { width: appState.width, height: appState.height },
    zoom: appState.zoom,
  });
};

export const updateIdeationScrollClamp = (
  nextState: Partial<AppState>,
  prevState: AppState,
  scene: Scene,
): Partial<AppState> => {
  if (prevState.scratchpadViewMode !== "ideation" || !prevState.ideationElementId) {
    return nextState;
  }

  const element = scene.getElement(prevState.ideationElementId);
  if (!element) {
    return nextState;
  }

  const elementsMap = scene.getElementsMapIncludingDeleted();
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);


  const zoom = (nextState.zoom ?? prevState.zoom) as Zoom;
  const height = nextState.height ?? prevState.height;
  const width = nextState.width ?? prevState.width;

  const minZoom = Math.max(MIN_ZOOM, height / (y2 - y1));
  const clampedZoom = {
    value: getNormalizedZoom(clamp(zoom.value, minZoom, MAX_ZOOM)),
  };

  const viewW = width / clampedZoom.value;
  const viewH = height / clampedZoom.value;
  const dx = (element.width * IDEATION_HORIZONTAL_SCROLL_FACTOR) / 2;
  const dy = viewH * IDEATION_VERTICAL_SCROLL_MARGIN_RATIO;

  let minScrollY = -(y2 - viewH) - dy;
  let maxScrollY = -y1 + dy;
  if (minScrollY > maxScrollY) {
    const extra = (minScrollY - maxScrollY) / 2;
    minScrollY -= extra;
    maxScrollY += extra;
  }

  const scrollY = clamp(
    nextState.scrollY ?? prevState.scrollY,
    minScrollY,
    maxScrollY,
  );

  const minScrollX = -(x2 - viewW) - dx;
  const maxScrollX = -x1 + dx;

  let scrollX = nextState.scrollX ?? prevState.scrollX;
  if (viewW > element.width * IDEATION_HORIZONTAL_SCROLL_FACTOR) {
    scrollX = viewW / 2 - (x1 + x2) / 2;
  } else {
    scrollX = clamp(scrollX, minScrollX, maxScrollX);
  }



  return {
  ...nextState,
    zoom: clampedZoom,
    scrollX,
    scrollY,
  };
};
