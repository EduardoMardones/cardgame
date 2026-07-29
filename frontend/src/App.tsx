import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MainMenuPage from "./pages/MainMenuPage";
import EditorPage from "./pages/EditorPage";
import GamePage from "./pages/GamePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DeckListPage from "./pages/DeckListPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";


// Wrapper que protege rutas: si no hay sesión redirige a /login.
// Mientras verifica el token muestra nada (evita flash de login).
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Wrapper inverso: si ya hay sesión en /login o /register, manda al menú.
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/"         element={<PrivateRoute><MainMenuPage /></PrivateRoute>} />
      <Route path="/editor"   element={<PrivateRoute><EditorPage /></PrivateRoute>} />
      <Route path="/juego" element={<PrivateRoute><GamePage /></PrivateRoute>} />
      <Route path="/mazos" element={<PrivateRoute><DeckListPage /></PrivateRoute>} />
      <Route path="/mazos/:deckId" element={<PrivateRoute><DeckBuilderPage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
