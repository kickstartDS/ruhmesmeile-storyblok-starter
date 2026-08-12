import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
} from "react";

import { Button } from "@kickstartds/ds";

import "./promo-tile.scss";

export interface PromoTileProps {
  /** The tile's headline. */
  headline: string;
  /** A sentence or two of supporting copy. */
  body: string;
  /** Label on the tile's call to action. */
  actionLabel: string;
  /** Optional icon shown before the action's label. */
  actionIcon?: string;
}

export const PromoTileContextDefault = forwardRef<
  HTMLDivElement,
  PromoTileProps & HTMLAttributes<HTMLDivElement>
>(({ headline, body, actionLabel, actionIcon, ...props }, ref) => (
  <div {...props} ref={ref} className="dsa-promo-tile">
    <h3 className="dsa-promo-tile__headline">{headline}</h3>
    <p className="dsa-promo-tile__body">{body}</p>

    <Button label={actionLabel} icon={actionIcon} variant="primary" />
  </div>
));

PromoTileContextDefault.displayName = "PromoTile";

export const PromoTileContext = createContext(PromoTileContextDefault);

export const PromoTile = forwardRef<
  HTMLDivElement,
  PromoTileProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(PromoTileContext);
  return <Component {...props} ref={ref} />;
});

PromoTile.displayName = "PromoTile";
