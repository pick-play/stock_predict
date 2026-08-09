import { useHashRoute } from "./hooks/useHashRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { BoardPage } from "./components/board/BoardPage";

export default function App() {
  const [route, navigate] = useHashRoute();

  if (route === "board") {
    return (
      <BoardPage onNavigateDashboard={() => navigate("dashboard")} />
    );
  }

  return <DashboardPage onNavigateBoard={() => navigate("board")} />;
}
