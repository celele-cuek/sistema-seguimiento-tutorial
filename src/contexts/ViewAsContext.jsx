import { createContext, useContext, useState } from 'react';

const ViewAsContext = createContext({ viewAs: null, setViewAs: () => {} });

export function ViewAsProvider({ children }) {
  const [viewAs, setViewAs] = useState(null); // null | 'TUTOR' | 'COORD'
  return (
    <ViewAsContext.Provider value={{ viewAs, setViewAs }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
