import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/Header.jsx";
import MyVenues from "./components/MyVenues.jsx";
import { VenueRegisterForm } from "./components/VenueRegisterForm.jsx";
import VenueOwnerRoute from "./components/VenueOwnerRoute.jsx";
import PartnerSignIn from "./components/PartnerSignIn.jsx";
import useCurrentUser from "./hooks/useCurrentUser.js";
import { SIGN_IN_PATH, ROLES } from "./auth/constants.js";
import { replaceRoute } from "./navigation.js";
import { getSessionRedirect } from "./auth/redirects.js";

function App() {
  const { currentUser } = useCurrentUser();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const isRegisterRoute = currentPath === "/venues/register";
  const isSignInRoute = currentPath === SIGN_IN_PATH;
  const redirectTo = getSessionRedirect(currentPath, currentUser);

  useEffect(() => {
    if (redirectTo) replaceRoute(redirectTo);
  }, [currentPath, redirectTo]);

  // Do not mount protected views or start their API calls during a redirect.
  if (redirectTo) return null;
  if (!currentUser) return <PartnerSignIn />;
  if (isSignInRoute) return null;

  return (
    <div className="app-shell">
      <Header isRegisterRoute={isRegisterRoute} />
      <main className="page-content">
        {currentPath === "/events" ? (
          <section className="state-panel" aria-labelledby="events-title">
            <div className="state-panel-inner">
              <h1 id="events-title">Mis eventos</h1>
              <p>{currentUser.role === ROLES.ORGANIZER
                ? "Bienvenido a tu espacio de eventos."
                : "Esta sección está disponible para organizadores."}</p>
            </div>
          </section>
        ) : isRegisterRoute ? (
          <VenueOwnerRoute>
            <VenueRegisterForm />
          </VenueOwnerRoute>
        ) : (
          <>
            <section className="page-intro" aria-labelledby="venues-title">
              <div>
                <p className="eyebrow">Panel del propietario</p>
                <h1 id="venues-title">Mis recintos</h1>
                <p className="page-description">
                  Administra los espacios que tienes registrados y mantén lista
                  la información que verán los organizadores.
                </p>
              </div>
              <div className="intro-decoration" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </section>
            <MyVenues />
          </>
        )}
      </main>
      <footer className="site-footer">
        <span className="brand-mark brand-mark--small" aria-hidden="true">
          V
        </span>
        <p>Venues · Encuentra el espacio para tu próximo gran evento.</p>
      </footer>
    </div>
  );
}

export default App;
