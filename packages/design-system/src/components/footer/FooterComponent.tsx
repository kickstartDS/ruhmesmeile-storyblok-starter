import classnames from "classnames";
import { Link } from "@kickstartds/base/lib/link";
import { Icon } from "@kickstartds/base/lib/icon";
import { FooterProps } from "./FooterProps";
import { Logo } from "../logo/LogoComponent";
import "./footer.scss";
import { createContext, forwardRef, HTMLAttributes, useContext } from "react";
import { deepMergeDefaults } from "../helpers";
import defaults from "./FooterDefaults";

export type { FooterProps };

export const FooterContextDefault = forwardRef<
  HTMLDivElement,
  FooterProps & HTMLAttributes<HTMLDivElement>
>(({ logo, inverted, navGroups, socialLinks, copyright, legalLink }, ref) => (
  <div
    className={classnames("dsa-footer")}
    ks-inverted={(inverted ?? false).toString()}
    ref={ref}
  >
    <div className="dsa-footer__content">
      {navGroups?.length || socialLinks?.length ? (
        <div className="dsa-footer__columns">
          {navGroups?.map((group, groupIdx) => (
            <div className="dsa-footer__column" key={group.heading ?? groupIdx}>
              {group.heading && (
                <h3 className="dsa-footer__column-heading">{group.heading}</h3>
              )}
              {group.items && group.items.length > 0 && (
                <ul className="dsa-footer__nav-list">
                  {group.items.map((item, itemIdx) => (
                    <li
                      className="dsa-footer__nav-item"
                      key={item.url + item.label + itemIdx}
                    >
                      <Link
                        className="dsa-footer__link"
                        href={item.url}
                        {...(item.newTab && {
                          target: "_blank",
                          rel: "noopener noreferrer",
                        })}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {socialLinks && socialLinks.length > 0 && (
            <div className="dsa-footer__column dsa-footer__column--social">
              <ul className="dsa-footer__social">
                {socialLinks.map((social, socialIdx) => (
                  <li
                    className="dsa-footer__social-item"
                    key={social.url + socialIdx}
                  >
                    <Link
                      className="dsa-footer__social-link"
                      href={social.url}
                      aria-label={social.ariaLabel}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon
                        role="presentation"
                        focusable="false"
                        aria-hidden
                        icon={social.icon}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <div className="dsa-footer__bottom">
        <Logo {...logo} inverted={inverted} />
        {(copyright || legalLink?.url) && (
          <p className="dsa-footer__copyright">
            {copyright}
            {legalLink?.url ? (
              <>
                {" "}
                <Link className="dsa-footer__legal-link" href={legalLink.url}>
                  {legalLink.label || "Legal"}
                </Link>
              </>
            ) : null}
          </p>
        )}
      </div>
    </div>
  </div>
));

export const FooterContext = createContext(FooterContextDefault);
export const Footer = forwardRef<
  HTMLDivElement,
  FooterProps & HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const Component = useContext(FooterContext);
  return <Component {...deepMergeDefaults(defaults, props)} ref={ref} />;
});
Footer.displayName = "Footer";
