import { useEffect, useRef } from 'react';
import { useAuth as useAuthContext } from '../contexts/AuthContext.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function useGoogleAuth() {
  const { signIn } = useAuthContext();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    const tryInit = () => {
      if (!window.google?.accounts?.id) return;
      initialized.current = true;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });
    };

    function handleCredentialResponse(response) {
      if (!response.credential) return;
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      signIn(response.credential, null);
    }

    tryInit();
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        tryInit();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [signIn]);

  function renderButton(elementId) {
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.renderButton(document.getElementById(elementId), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      locale: 'es',
      width: 280,
    });
  }

  return { renderButton };
}

export function useTokenClient() {
  const { signIn } = useAuthContext();

  function requestToken(onSuccess, onError) {
    if (!window.google?.accounts?.oauth2) {
      onError?.(new Error('GSI no cargado'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets openid email profile',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          onError?.(new Error(tokenResponse.error));
          return;
        }
        try {
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          const userInfo = await userInfoRes.json();
          if (!userInfo.email) {
            throw new Error(
              userInfo.error_description ||
              'No se pudo obtener el correo desde Google. Asegúrate de permitir todos los permisos al iniciar sesión.'
            );
          }
          await signIn(null, tokenResponse.access_token, userInfo.email);
          onSuccess?.(tokenResponse);
        } catch (err) {
          onError?.(err);
        }
      },
    });
    client.requestAccessToken();
  }

  return { requestToken };
}
