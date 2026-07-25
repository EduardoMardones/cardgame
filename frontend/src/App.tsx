import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainMenuPage from "./pages/MainMenuPage";
import EditorPage from "./pages/EditorPage";
import GamePage from "./pages/GamePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/juego" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}