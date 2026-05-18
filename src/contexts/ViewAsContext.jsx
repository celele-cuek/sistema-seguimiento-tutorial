import { createContext, useContext, useState } from 'react';

const ViewAsContext = createContext({
  viewAs: null, setViewAs: () => {},
  viewAsTutor: null, setViewAsTutor: () => {},
});

export function ViewAsProvider({ children }) {
  const [viewAs, setViewAs] = useState(null); // null | 'TUTOR' | 'COORD'
  const [viewAsTutor, setViewAsTutor] = useState(null); // { correo, nombre, grupos: [] }
  return (
    <ViewAsContext.Provider value={{ viewAs, setViewAs, viewAsTutor, setViewAsTutor }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
