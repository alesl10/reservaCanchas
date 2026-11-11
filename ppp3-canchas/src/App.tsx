import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context";
import { ProtectedRoute, ChatCanchasWidget, InstalarAppAviso } from "@/components";
import { ErrorBoundary, Spinner } from "@/components/atoms";
const HomePage = lazy(() =>
  import("@/components/organims/home/home").then((m) => ({
    default: m.HomePage,
  })),
);
const LoginPage = lazy(() =>
  import("@/components/organims/login/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);
const ReservarPage = lazy(() =>
  import("@/components/organims/reserve/ReservarPage").then((m) => ({
    default: m.ReservarPage,
  })),
);
const ReservartionsPage = lazy(() =>
  import("@/components/organims/my-reservations").then((m) => ({
    default: m.ReservartionsPage,
  })),
);
const AdminPage = lazy(() =>
  import("@/components/organims/dashboard-admin/AdminPage").then((m) => ({
    default: m.AdminPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/components/organims/notFound/not-found-page").then((m) => ({
    default: m.NotFoundPage,
  })),
);
const ForbiddenPage = lazy(() =>
  import("@/components/organims/notFound/forbidden-page").then((m) => ({
    default: m.ForbiddenPage,
  })),
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              {/* Pública: se pueden ver canchas y horarios sin sesión; el login se pide al confirmar. */}
              <Route path="/reservar" element={<ReservarPage />} />
              <Route
                path="/mis-reservas"
                element={
                  <ProtectedRoute requiredRole="cliente">
                    <ReservartionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/forbidden" element={<ForbiddenPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <ChatCanchasWidget />
          <InstalarAppAviso />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
