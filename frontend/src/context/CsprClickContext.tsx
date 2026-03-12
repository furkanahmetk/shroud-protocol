import React, { createContext, useContext } from 'react';

const CsprClickContext = createContext<any>(null);

export const useCsprClick = (): any => useContext(CsprClickContext);

export { CsprClickContext };
