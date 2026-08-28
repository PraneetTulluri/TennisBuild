import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import Header from "./components/Header/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import DraftPage from "./pages/DraftPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import CareerPage from "./pages/CareerPage.jsx";
import MyBuildsPage from "./pages/MyBuildsPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import SavedBuildPage from "./pages/SavedBuildPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/draft" element={<DraftPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/career" element={<CareerPage />} />
          <Route path="/builds" element={<MyBuildsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/builds/:id" element={<SavedBuildPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
