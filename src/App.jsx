import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/Header.jsx";
import MyVenues from "./components/MyVenues.jsx";
import { VenueRegisterForm } from "./components/VenueRegisterForm.jsx";
import VenueOwnerRoute from "./components/VenueOwnerRoute.jsx";
import PartnerSignIn from "./components/PartnerSignIn.jsx";
import useCurrentUser from "./hooks/useCurrentUser.js";
import { SIGN_IN_PATH } from "./auth/constants.js";
import { replaceRoute } from "./navigation.js";
import { getSessionRedirect } from "./auth/redirects.js";
import { canAccessRoute, getRouteRole } from "./auth/access.js";
import { getPartnerHome } from "./auth/mockAuth.js";
import EventRegisterPage from "./components/EventRegisterPage.jsx";
import PartnerRegister from "./components/PartnerRegister.jsx";
import OrganizerEventsPage from "./components/OrganizerEventsPage.jsx";
import EventDetailPage from "./domains/events/detail/EventDetailPage.jsx";

function App() {
  const { currentUser } = useCurrentUser();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const eventDetailMatch = currentPath.match(/^\/events\/([^/]+)$/);
  const eventDetailId = eventDetailMatch && eventDetailMatch[1] !== "register"
    ? decodeURIComponent(eventDetailMatch[1])
    : null;
  const isRegisterRoute = currentPath === "/venues/register" || currentPath === "/events/register";
  const isSignInRoute = currentPath === SIGN_IN_PATH;
  const redirectTo = getSessionRedirect(currentPath, currentUser);
  const hasAccess = canAccessRoute(currentUser, currentPath);
  const isKnownView = Boolean(eventDetailId) || ["/", "/venues", "/venues/register", "/events", "/events/register"].includes(currentPath);

  useEffect(() => {
    if (redirectTo) replaceRoute(redirectTo);
  }, [currentPath, redirectTo]);

  // Do not mount protected views or start their API calls during a redirect.
  if (redirectTo) return null;
  if (!currentUser && currentPath === "/register") return <PartnerRegister />;
  if (!currentUser) return <PartnerSignIn />;
  if (isSignInRoute) return null;

  return (
    <div className="app-shell">
      <Header isRegisterRoute={isRegisterRoute} />
      <main className="page-content" key={currentUser.token}>
        {getRouteRole(currentPath) && !hasAccess ? (
          <section className="state-panel state-panel--error" role="alert">
            <div className="state-panel-inner">
              <h1>No tienes acceso a esta sección</h1>
              <p>Esta sección corresponde a otro tipo de cuenta.</p>
              <a className="primary-button" href={getPartnerHome(currentUser)}>Volver a mi panel</a>
            </div>
          </section>
        ) : !isKnownView ? (
          <section className="state-panel">
            <div className="state-panel-inner">
              <h1>Página no encontrada</h1>
              <a className="primary-button" href={getPartnerHome(currentUser)}>Volver a mi panel</a>
            </div>
          </section>
        ) : eventDetailId ? (
          <EventDetailPage eventId={eventDetailId} />
        ) : currentPath === "/events" ? (
          <OrganizerEventsPage />
        ) : currentPath === "/events/register" ? (
          <EventRegisterPage />
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
