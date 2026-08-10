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
    // No chat link here by owner decision: the chat room is reached from the
    // dashboard, not from the board.
    return <BoardPage onNavigateDashboard={() => navigate("dashboard")} />;
  }

  return (
    <DashboardPage
      onNavigateBoard={() => navigate("board")}
      onNavigateChat={() => navigate("chat")}
    />
  );
}
