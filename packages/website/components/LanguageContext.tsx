import { FC, PropsWithChildren, createContext, useContext } from "react";
import { locale } from ".";

const LanguageContext = createContext<string>(locale);
export const LanguageProvider: FC<PropsWithChildren<{ language: string }>> = (
  props,
) => {
  return (
    <LanguageContext.Provider value={props.language}>
      {props.children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  return useContext(LanguageContext);
};

type Alternate = { id?: number; full_slug?: string };

const AlternatesContext = createContext<Alternate[]>([]);
export const AlternatesProvider: FC<
  PropsWithChildren<{ alternates: Alternate[] }>
> = (props) => {
  return (
    <AlternatesContext.Provider value={props.alternates}>
      {props.children}
    </AlternatesContext.Provider>
  );
};

export const useAlternates = () => {
  return useContext(AlternatesContext);
};
