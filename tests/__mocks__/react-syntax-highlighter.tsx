import React from 'react';

interface SyntaxHighlighterProps {
  children?: string;
  language?: string;
  style?: object;
  customStyle?: object;
  className?: string;
}

interface PrismComponent extends React.FC<SyntaxHighlighterProps> {
  registerLanguage: (name: string, lang: any) => void;
}

export const PrismAsyncLight: PrismComponent = Object.assign(
  ({ children, className }: SyntaxHighlighterProps) => {
    return <pre className={className} data-testid="syntax-highlighter">{children}</pre>;
  },
  { registerLanguage: () => {} }
);

export const Prism = PrismAsyncLight;
export const Light = PrismAsyncLight;

export default PrismAsyncLight;

// Mock language imports
export const tsx = {};
export const python = {};
export const javascript = {};
export const typescript = {};
export const sql = {};
export const json = {};
export const bash = {};

// Mock style imports
export const coldarkDark = {};
export const oneDark = {};
export const vscDarkPlus = {};
