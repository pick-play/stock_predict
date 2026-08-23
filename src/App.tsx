import { lazy, Suspense } from "react";
import { useHashRoute } from "./hooks/useHashRoute";
import { useSitePresence } from "./hooks/useSitePresence";
import { DashboardPage } from "./pages/DashboardPage";

/*
 * Only the dashboard is in the main bundle.
 *
 * It is the page every visitor lands on; the other three are behind a
 * navigation click, and most visits never make one. The admin console is the
 * extreme case — it is reached by typing the hash, so shipping it to everyone
 * meant every reader downloading a console that §28.5 goes out of its way not
 * to link.
 *
 * The fallback is nothing on purpose: these chunks arrive in well under a
 * second, and body already paints the theme background (§28.1), so a spinner
 * would flash more than it informs.
 */
const BoardPage = lazy(() =>
  import("./components/board/BoardPage").then((m) => ({ default: m.BoardPage }))
);
const ChatPage = lazy(() =>
  import("./components/chat/ChatPage").then((m) => ({ default: m.ChatPage }))
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage }))
);

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
    return (
      <Suspense fallback={null}>
        <AdminPage onNavigateDashboard={() => navigate("dashboard")} />
      </Suspense>
    );
  }

  if (route === "chat") {
    return (
      <Suspense fallback={null}>
        <ChatPage onNavigateDashboard={() => navigate("dashboard")} />
      </Suspense>
    );
  }

  if (route === "board") {
    // No chat link here by owner decision: the chat room is reached from the
    // dashboard, not from the board.
    return (
      <Suspense fallback={null}>
        <BoardPage onNavigateDashboard={() => navigate("dashboard")} />
      </Suspense>
    );
  }

  return (
    <DashboardPage
      onNavigateBoard={() => navigate("board")}
      onNavigateChat={() => navigate("chat")}
    />
  );
}
