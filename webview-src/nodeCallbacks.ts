import React from 'react';

export const NodeCallbacksContext = React.createContext<{
  onEditTable: (id: string) => void;
  editorMode: boolean;
  locked: boolean;
}>({ onEditTable: () => {}, editorMode: false, locked: true });
