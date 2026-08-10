import { useHashRoute } from "./hooks/useHashRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { BoardPage } from "./components/board/BoardPage";
import { ChatPage } from "./components/chat/ChatPage";

export default function App() {
  const [route, navigate] = useHashRoute();

  if (route === "chat") {
    return <ChatPage onNavigateDashboard={() => navigate("dashboard")} />;
  }

  if (route === "board") {
    return (
      <BoardPage
        onNavigateDashboard={() => navigate("dashboard")}
        onNavigateChat={() => navigate("chat")}
      />
    );
  }

  return (
    <DashboardPage
      onNavigateBoard={() => navigate("board")}
      onNavigateChat={() => navigate("chat")}
    />
  );
}
