import type {
  Context,
  DependencyList,
  ForwardedRef,
  FunctionComponentElement,
  MutableRefObject,
  ProviderProps,
} from "react";

export declare const useKsComponent: <R extends HTMLElement = HTMLDivElement>(
  identifier: string,
  ref?: ForwardedRef<R>,
  deps?: DependencyList,
) => { "ks-component": string; ref: MutableRefObject<R | null> };

export declare const createProvider: <V>(
  context: Context<V>,
  value: V,
) => (props: ProviderProps<V>) => FunctionComponentElement<ProviderProps<V>>;
