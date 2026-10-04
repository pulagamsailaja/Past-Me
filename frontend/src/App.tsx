import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./App.css";

type Memory = {
  id: string;
  content: string;
  memory_date: string;
  created_at: string;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [memoryText, setMemoryText] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchMemories();
    } else {
      setMemories([]);
    }
  }, [session]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();

    setAuthMessage("");
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setAuthMessage(
          "Account created. Check your email if confirmation is enabled."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function fetchMemories() {
    setMemoryLoading(true);

    const { data, error } = await supabase
      .from("memories")
      .select("id, content, memory_date, created_at")
      .order("memory_date", { ascending: false });

    if (error) {
      setMemoryMessage(error.message);
    } else {
      setMemories(data ?? []);
    }

    setMemoryLoading(false);
  }

  async function saveMemory(e: React.FormEvent) {
    e.preventDefault();

    if (!session?.user) return;
    if (!memoryText.trim()) return;

    setMemoryLoading(true);
    setMemoryMessage("");

    const dateToSave = memoryDate
      ? new Date(`${memoryDate}T12:00:00`).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("memories").insert({
      user_id: session.user.id,
      content: memoryText.trim(),
      memory_date: dateToSave,
    });

    if (error) {
      setMemoryMessage(error.message);
    } else {
      setMemoryText("");
      setMemoryDate("");
      setMemoryMessage("Memory saved.");
      await fetchMemories();
    }

    setMemoryLoading(false);
  }

  async function deleteMemory(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this memory?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", id);

    if (error) {
      setMemoryMessage(error.message);
      return;
    }

    setMemories((current) =>
      current.filter((memory) => memory.id !== id)
    );
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  }

  if (authLoading && !session) {
    return (
      <main className="app">
        <p>Loading Past Me...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app">
        <section className="auth-container">
          <div className="logo">PAST ME</div>

          <h1 className="auth-title">
            {isSignUp ? "Meet your past self." : "Welcome back."}
          </h1>

          <p className="subtitle">
            {isSignUp
              ? "Create your private memory space."
              : "Your memories are waiting for you."}
          </p>

          <form className="auth-form" onSubmit={handleAuth}>
            <label>
              Email
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>

            <button
              className="primary-button auth-button"
              disabled={authLoading}
              type="submit"
            >
              {authLoading
                ? "Please wait..."
                : isSignUp
                ? "Create Account"
                : "Log In"}
            </button>
          </form>

          {authMessage && (
            <p className="auth-message">{authMessage}</p>
          )}

          <button
            className="switch-button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthMessage("");
            }}
          >
            {isSignUp
              ? "Already have an account? Log in"
              : "New here? Create an account"}
          </button>

          <p className="principle">
            Past Me reminds. It never decides.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div className="logo topbar-logo">PAST ME</div>

        <button className="logout-button" onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <div className="dashboard-content">
        <section className="memory-hero">
          <p className="eyebrow">YOUR PRIVATE MEMORY SPACE</p>

          <h1>What do you want your future self to remember?</h1>

          <p className="subtitle">
            Save moments, goals, hopes, decisions, achievements, and
            reflections. Past Me can reconnect you with them later.
          </p>

          <form className="memory-form" onSubmit={saveMemory}>
            <textarea
              placeholder="I worked so hard for this opportunity..."
              value={memoryText}
              onChange={(e) => setMemoryText(e.target.value)}
              rows={6}
              required
            />

            <div className="memory-form-bottom">
              <div className="date-field">
                <label htmlFor="memory-date">When was this?</label>

                <input
                  id="memory-date"
                  type="date"
                  value={memoryDate}
                  onChange={(e) => setMemoryDate(e.target.value)}
                />
              </div>

              <button
                className="primary-button"
                disabled={memoryLoading}
                type="submit"
              >
                {memoryLoading ? "Saving..." : "Save Memory"}
              </button>
            </div>
          </form>

          {memoryMessage && (
            <p className="memory-message">{memoryMessage}</p>
          )}
        </section>

        <section className="memories-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PAST</p>
              <h2>Memories</h2>
            </div>

            <span>{memories.length} saved</span>
          </div>

          {memoryLoading && memories.length === 0 ? (
            <p className="empty-state">Loading memories...</p>
          ) : memories.length === 0 ? (
            <div className="empty-state">
              <h3>No memories yet.</h3>
              <p>
                Your first memory will become the beginning of your
                timeline.
              </p>
            </div>
          ) : (
            <div className="memory-list">
              {memories.map((memory) => (
                <article className="memory-card" key={memory.id}>
                  <div className="memory-dot" />

                  <div className="memory-card-content">
                    <time>{formatDate(memory.memory_date)}</time>

                    <p>{memory.content}</p>

                    <button
                      className="delete-button"
                      onClick={() => deleteMemory(memory.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer>Past Me reminds. It never decides.</footer>
      </div>
    </main>
  );
}

export default App;