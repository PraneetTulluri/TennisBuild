import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import DraftPage from "./pages/DraftPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import CareerPage from "./pages/CareerPage.jsx";
import MyBuildsPage from "./pages/MyBuildsPage.jsx";
import SavedBuildPage from "./pages/SavedBuildPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/draft" element={<DraftPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/career" element={<CareerPage />} />
        <Route path="/builds" element={<MyBuildsPage />} />
        <Route path="/builds/:id" element={<SavedBuildPage />} />
      </Routes>
    </BrowserRouter>
  );
}
