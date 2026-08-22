import { useHashRoute } from "./hooks/useHashRoute";
import { useSitePresence } from "./hooks/useSitePresence";
import { DashboardPage } from "./pages/DashboardPage";
import { BoardPage } from "./components/board/BoardPage";
import { ChatPage } from "./components/chat/ChatPage";
import { AdminPage } from "./pages/AdminPage";

export default function App() {
  const [route, navigate] = useHashRoute();

  /*
   * Above the route switch, so it survives navigation between pages.
   *
   * Putting it inside a page would restart the interval on every hash change
   * and stop counting anyone who happened to be reading the one page that
   * forgot to call it.
   */
  useSitePresence();

  // Reached by typing the hash. Nothing links here; the password is the gate.
  if (route === "admin") {
    return <AdminPage onNavigateDashboard={() => navigate("dashboard")} />;
  }

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
