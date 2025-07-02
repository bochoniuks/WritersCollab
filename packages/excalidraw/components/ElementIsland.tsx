import React from "react";
import clsx from "clsx";

import { Island } from "./Island";
import "./ElementIsland.scss";

type ElementIslandProps = {
  children: React.ReactNode;
  padding?: number;
  className?: string | boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>;;

/**
 * Floating container for element‑level toolbars.
 * Uses smaller buttons than the main toolbar.
 */
export const ElementIsland = React.forwardRef<HTMLDivElement, ElementIslandProps>(
  ({ children, padding = 1, className, style, ...rest }, ref) => (
    <Island
      ref={ref}
      padding={padding}
      className={clsx("ElementIsland", className)}
      style={style}
      {...rest}
    >
      {children}
    </Island>
  ),
);

ElementIsland.displayName = "ElementIsland";
