import { createContext, useContext, useState } from 'react';

const ViewAsContext = createContext({
  viewAsRole: null, setViewAsRole: () => {},
  viewAsTutor: null, setViewAsTutor: () => {},
});

export function ViewAsProvider({ children }) {
  // viewAsRole: null = real role | 'TUTOR' | 'COORD' | 'ASISTENTE'
  const [viewAsRole, setViewAsRole] = useState(null);
  const [viewAsTutor, setViewAsTutor] = useState(null); // { correo, nombre, grupos: [] }

  // Legacy alias so existing code using viewAs still works
  const viewAs = viewAsRole;
  const setViewAs = setViewAsRole;

  return (
    <ViewAsContext.Provider value={{ viewAsRole, setViewAsRole, viewAs, setViewAs, viewAsTutor, setViewAsTutor }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
