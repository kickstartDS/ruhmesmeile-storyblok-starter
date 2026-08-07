export declare const uid: () => string;

export declare class Component {
  constructor(element: HTMLElement);
  readonly element: HTMLElement;
  onDisconnect(callback: () => void): void;
  disconnect(): void;
}

export declare const define: (
  identifier: string,
  Behaviour: new (element: HTMLElement) => Component,
) => void;
