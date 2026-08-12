import type {
  ButtonHTMLAttributes,
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from "react";

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  /** Icon identifier, e.g. `arrow-right`. */
  icon: string;
}

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  /** Accessible, visible label. */
  label: string;
  variant?: "primary" | "secondary" | "tertiary";
  size?: "small" | "medium" | "large";
  /** Optional icon rendered before the label. */
  icon?: string;
  type?: "button" | "submit" | "reset";
}

export interface HeadlineProps extends HTMLAttributes<HTMLHeadingElement> {
  text: string;
  level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  spaceAfter?: "none" | "small" | "large";
}

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  text: string;
}

export declare const Icon: ForwardRefExoticComponent<
  IconProps & RefAttributes<HTMLSpanElement>
>;
export declare const Button: ForwardRefExoticComponent<
  ButtonProps & RefAttributes<HTMLButtonElement>
>;
export declare const Headline: ForwardRefExoticComponent<
  HeadlineProps & RefAttributes<HTMLHeadingElement>
>;
export declare const Text: ForwardRefExoticComponent<
  TextProps & RefAttributes<HTMLParagraphElement>
>;
