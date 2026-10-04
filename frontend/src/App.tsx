import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./App.css";

type Memory = {
  id: string;
  title: string | null;
  content: string;
  memory_date: string;
  created_at: string;
};

type ConnectedMemory = {
  id: string;
  title?: string | null;
  content: string;
  memory_date: string;
  similarity: number;
  matched_from?: string;
  matched_text?: string;
};

type EditorMode = "view" | "new" | "edit";

type MemoryGroup = {
  key: string;
  label: string;
  memories: Memory[];
};

const API_URL = "http://127.0.0.1:8000";
const DRAFT_KEY = "past-me-journal-draft";

const WRITING_PROMPTS = [
  "What happened today that you don't want to forget?",
  "What are you hoping will be different a month from now?",
  "What felt heavier than you expected today?",
  "What made you smile, even for a moment?",
  "What are you proud of yourself for today?",
  "What would you want your future self to remember about this moment?",
  "What are you still trying to understand?",
  "What changed in you today, even a little?",
];

const POCKET_NOTES = [
  "You don't need to have everything figured out today.",
  "Small progress is still progress.",
  "Some chapters make sense only after you leave them.",
  "You don't have to solve tomorrow tonight.",
  "Rest is part of moving forward.",
  "A quiet day can still be an important day.",
  "You are allowed to change your mind as you learn more.",
  "Not every meaningful moment looks important while you're living it.",
  "Keep a little room for things to surprise you.",
  "You can move slowly and still be moving.",
];

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("new");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalDate, setJournalDate] = useState(getTodayInputDate());
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalMessage, setJournalMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [journalMenuOpen, setJournalMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const journalMenuRef = useRef<HTMLDivElement | null>(null);

  const [pocketNoteOpen, setPocketNoteOpen] = useState(false);
  const [pocketNoteIndex, setPocketNoteIndex] = useState(0);

  const [connectedMemories, setConnectedMemories] = useState<ConnectedMemory[]>([]);
  const [currentConnectionIndex, setCurrentConnectionIndex] = useState(0);
  const [showConnectionPopup, setShowConnectionPopup] = useState(false);
  const [showPastMemory, setShowPastMemory] = useState(false);
  const [newMemoryId, setNewMemoryId] = useState<string | null>(null);
  const [connectionJournalIds, setConnectionJournalIds] = useState<Set<string>>(new Set());

  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedMemoryId) ?? null,
    [memories, selectedMemoryId]
  );

  const currentConnection = connectedMemories[currentConnectionIndex] ?? null;
  const userEmail = session?.user.email ?? "";
  const userInitial = userEmail.charAt(0).toUpperCase() || "U";
  const wordCount = countWords(journalContent);

  const filteredMemories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return memories;
    return memories.filter((memory) => {
      const title = getDisplayTitle(memory).toLowerCase();
      return title.includes(query) || memory.content.toLowerCase().includes(query);
    });
  }, [memories, searchQuery]);

  const groupedMemories = useMemo(
    () => groupMemoriesByMonth(filteredMemories),
    [filteredMemories]
  );

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
      startNewJournal();
    } else {
      setMemories([]);
      setSelectedMemoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
      if (journalMenuRef.current && !journalMenuRef.current.contains(target)) {
        setJournalMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (editorMode !== "new") return;

    const hasDraft = journalTitle.trim() || journalContent.trim();
    if (!hasDraft) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: journalTitle,
        content: journalContent,
        date: journalDate || getTodayInputDate(),
      })
    );
  }, [editorMode, journalTitle, journalContent, journalDate]);

  useEffect(() => {
    if (!journalMessage) return;
    const timer = window.setTimeout(() => setJournalMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [journalMessage]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthMessage("");
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage("Account created. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
  }

  async function fetchMemories(preferredId?: string) {
    const { data, error } = await supabase
      .from("memories")
      .select("id, title, content, memory_date, created_at")
      .order("memory_date", { ascending: false });

    if (error) {
      setJournalMessage(error.message);
      return;
    }

    const loaded = data ?? [];
    setMemories(loaded);

    if (preferredId) {
      setSelectedMemoryId(preferredId);
      return;
    }

    if (selectedMemoryId && loaded.some((memory) => memory.id === selectedMemoryId)) {
      return;
    }
  }

  function startNewJournal() {
    setEditorMode("new");
    setSelectedMemoryId(null);
    setJournalMessage("");
    setJournalMenuOpen(false);

    const storedDraft = localStorage.getItem(DRAFT_KEY);
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        setJournalTitle(draft.title ?? "");
        setJournalContent(draft.content ?? "");
        setJournalDate(draft.date ?? getTodayInputDate());
        return;
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }

    setJournalTitle("");
    setJournalContent("");
    setJournalDate(getTodayInputDate());
    setPromptIndex(Math.floor(Math.random() * WRITING_PROMPTS.length));
  }

  function openJournal(memory: Memory) {
    setSelectedMemoryId(memory.id);
    setEditorMode("view");
    setJournalMessage("");
    setJournalMenuOpen(false);
    setAccountMenuOpen(false);
  }

  function startEditing() {
    if (!selectedMemory) return;
    setJournalTitle(selectedMemory.title ?? "");
    setJournalContent(selectedMemory.content);
    setJournalDate(toDateInputValue(selectedMemory.memory_date));
    setEditorMode("edit");
    setJournalMessage("");
    setJournalMenuOpen(false);
  }

  function cancelEditing() {
    setEditorMode("view");
    setJournalMessage("");
  }

  async function saveNewJournal(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) return;

    if (!journalContent.trim()) {
      setJournalMessage("Write something before saving.");
      return;
    }

    setJournalLoading(true);
    setJournalMessage("");

    try {
      const dateToSave = journalDate
        ? new Date(`${journalDate}T12:00:00`).toISOString()
        : new Date().toISOString();

      const response = await fetch(`${API_URL}/memories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: journalTitle.trim() || null,
          content: journalContent.trim(),
          memory_date: dateToSave,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save journal.");

      localStorage.removeItem(DRAFT_KEY);
      const createdId = data.memory.id;
      setNewMemoryId(createdId);
      await fetchMemories(createdId);
      setEditorMode("view");
      setJournalTitle("");
      setJournalContent("");
      setJournalDate(getTodayInputDate());
      setJournalMessage("Journal saved.");

      if (Array.isArray(data.connections) && data.connections.length > 0) {
        setConnectedMemories(data.connections);
        setCurrentConnectionIndex(0);
        setShowPastMemory(false);
        setShowConnectionPopup(true);
        setConnectionJournalIds((current) => {
          const updated = new Set(current);
          updated.add(createdId);
          return updated;
        });
      }
    } catch (error) {
      setJournalMessage(error instanceof Error ? error.message : "Could not save journal.");
    } finally {
      setJournalLoading(false);
    }
  }

  async function saveEditedJournal(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedMemory) return;

    if (!journalContent.trim()) {
      setJournalMessage("Journal cannot be empty.");
      return;
    }

    setJournalLoading(true);
    setJournalMessage("");

    try {
      const dateToSave = journalDate
        ? new Date(`${journalDate}T12:00:00`).toISOString()
        : selectedMemory.memory_date;

      const response = await fetch(`${API_URL}/memories/${selectedMemory.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: journalTitle.trim() || null,
          content: journalContent.trim(),
          memory_date: dateToSave,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not update journal.");

      await fetchMemories(selectedMemory.id);
      setEditorMode("view");
      setJournalMessage("Changes saved.");
    } catch (error) {
      setJournalMessage(error instanceof Error ? error.message : "Could not update journal.");
    } finally {
      setJournalLoading(false);
    }
  }

  async function deleteMemory(id: string) {
    const confirmed = window.confirm("Are you sure you want to delete this journal?");
    if (!confirmed) return;

    const { error } = await supabase.from("memories").delete().eq("id", id);
    if (error) {
      setJournalMessage(error.message);
      return;
    }

    const remaining = memories.filter((memory) => memory.id !== id);
    setMemories(remaining);
    setConnectionJournalIds((current) => {
      const updated = new Set(current);
      updated.delete(id);
      return updated;
    });

    if (selectedMemoryId === id) {
      if (remaining.length > 0) openJournal(remaining[0]);
      else startNewJournal();
    }

    setJournalMenuOpen(false);
    setJournalMessage("Journal deleted.");
  }

  async function deleteNewMemory() {
    if (!newMemoryId) return;
    const confirmed = window.confirm("Delete the journal you just wrote?");
    if (!confirmed) return;

    const idToDelete = newMemoryId;
    const { error } = await supabase.from("memories").delete().eq("id", idToDelete);
    if (error) {
      setJournalMessage(error.message);
      return;
    }

    setMemories((current) => current.filter((memory) => memory.id !== idToDelete));
    setConnectionJournalIds((current) => {
      const updated = new Set(current);
      updated.delete(idToDelete);
      return updated;
    });

    closePopup();
    startNewJournal();
    setJournalMessage("The journal you just wrote was deleted.");
  }

  function takeMeBack() {
    if (memories.length === 0) {
      setJournalMessage("You don't have any past journals yet.");
      return;
    }

    let candidates = memories;
    if (selectedMemoryId && memories.length > 1) {
      candidates = memories.filter((memory) => memory.id !== selectedMemoryId);
    }

    openJournal(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  function openPocketNote() {
    setPocketNoteIndex(Math.floor(Math.random() * POCKET_NOTES.length));
    setPocketNoteOpen(true);
  }

  function anotherPocketNote() {
    setPocketNoteIndex((current) => {
      if (POCKET_NOTES.length <= 1) return 0;
      let next = current;
      while (next === current) next = Math.floor(Math.random() * POCKET_NOTES.length);
      return next;
    });
  }

  function nextPrompt() {
    setPromptIndex((current) => (current + 1) % WRITING_PROMPTS.length);
  }

  function closePopup() {
    setShowConnectionPopup(false);
    setShowPastMemory(false);
    setConnectedMemories([]);
    setCurrentConnectionIndex(0);
    setNewMemoryId(null);
  }

  function nextConnection() {
    if (currentConnectionIndex < connectedMemories.length - 1) {
      setCurrentConnectionIndex((current) => current + 1);
    }
  }

  function previousConnection() {
    if (currentConnectionIndex > 0) {
      setCurrentConnectionIndex((current) => current - 1);
    }
  }

  if (authLoading && !session) {
    return (
      <main className="app app-loading">
        <div className="loading-mark">✦</div>
        <p>Opening Past Me...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app auth-page">
        <section className="auth-container">
          <div className="auth-brand"><span>✦</span> PAST ME</div>
          <p className="auth-kicker">A PRIVATE JOURNAL ACROSS TIME</p>
          <h1 className="auth-title">{isSignUp ? "Meet your past self." : "Welcome back."}</h1>
          <p className="subtitle">
            {isSignUp
              ? "Create a private place for the moments your future self may need."
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
            <button className="primary-button auth-button" disabled={authLoading} type="submit">
              {authLoading ? "Please wait..." : isSignUp ? "Create Account" : "Log In"}
            </button>
          </form>

          {authMessage && <p className="auth-message">{authMessage}</p>}

          <button
            className="switch-button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthMessage("");
            }}
          >
            {isSignUp ? "Already have an account? Log in" : "New here? Create an account"}
          </button>

          <p className="principle">Past Me reminds. It never decides.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="journal-app">
      <aside className="journal-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand"><span className="brand-sparkle">✦</span><span>PAST ME</span></div>

          <button className="new-journal-button" onClick={startNewJournal}>
            <span>＋</span><span>New Journal</span>
          </button>

          <div className={`sidebar-search ${searchOpen ? "open" : ""}`}>
            {searchOpen ? (
              <>
                <span className="search-symbol">⌕</span>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search journals"
                />
                <button
                  className="search-close"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  aria-label="Close search"
                >
                  ×
                </button>
              </>
            ) : (
              <button className="search-trigger" onClick={() => setSearchOpen(true)}>
                <span>⌕</span><span>Search journals</span>
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-history">
          {memories.length === 0 ? (
            <div className="sidebar-empty-state">
              <span>○</span>
              <p>Your past will appear here.</p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <p className="sidebar-empty">No journals found.</p>
          ) : (
            <div className="journal-history-list">
              {groupedMemories.map((group) => (
                <div className="history-group" key={group.key}>
                  <p className="sidebar-label">{group.label}</p>
                  {group.memories.map((memory) => {
                    const active = selectedMemoryId === memory.id && editorMode !== "new";
                    const hasConnection = connectionJournalIds.has(memory.id);
                    return (
                      <button
                        key={memory.id}
                        className={active ? "history-item active" : "history-item"}
                        onClick={() => openJournal(memory)}
                        title={getDisplayTitle(memory)}
                      >
                        <span className={`history-icon ${hasConnection ? "connected" : ""}`}>
                          {hasConnection ? "✦" : "○"}
                        </span>
                        <span className="history-copy">
                          <span className="history-title">{getDisplayTitle(memory)}</span>
                          <span className="history-date">{formatShortDate(memory.memory_date)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-tool-button" onClick={takeMeBack}><span>✦</span><span>Take me back</span></button>
          <button className="sidebar-tool-button" onClick={openPocketNote}><span>♡</span><span>Pocket Note</span></button>
          <p className="sidebar-principle">Past Me reminds.<br />It never decides.</p>
        </div>
      </aside>

      <section className="journal-workspace">
        <header className="workspace-header">
          <div className="workspace-mobile-brand"><span>✦</span> PAST ME</div>
          <div className="account-wrapper" ref={accountMenuRef}>
            <button
              className="avatar-button"
              onClick={() => setAccountMenuOpen((current) => !current)}
              aria-label="Open account menu"
            >
              {userInitial}
            </button>
            {accountMenuOpen && (
              <div className="account-menu">
                <p className="account-menu-label">SIGNED IN AS</p>
                <p className="account-email">{userEmail}</p>
                <div className="account-menu-divider" />
                <button className="account-logout" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        </header>

        <div className="workspace-stage" key={`${editorMode}-${selectedMemoryId ?? "new"}`}>
          {editorMode === "new" && (
            <section className="journal-compose-page">
              <div className="compose-topline">
                <input
                  className="inline-date-input"
                  type="date"
                  value={journalDate}
                  onChange={(e) => setJournalDate(e.target.value)}
                  aria-label="Journal date"
                />
                <span className="compose-hint">A page for your future self</span>
              </div>

              <form className="journal-compose-form" onSubmit={saveNewJournal}>
                <input
                  className="compose-title-input"
                  type="text"
                  placeholder="Untitled Journal"
                  value={journalTitle}
                  onChange={(e) => setJournalTitle(e.target.value)}
                  maxLength={100}
                />

                <div className="compose-rule" />

                {!journalContent.trim() && (
                  <div className="writing-prompt">
                    <span>Not sure where to start?</span>
                    <button type="button" onClick={nextPrompt}>{WRITING_PROMPTS[promptIndex]}</button>
                    <button className="another-prompt" type="button" onClick={nextPrompt}>Another prompt ↻</button>
                  </div>
                )}

                <textarea
                  className="compose-textarea"
                  placeholder="Start writing..."
                  value={journalContent}
                  onChange={(e) => setJournalContent(e.target.value)}
                  autoFocus
                />

                <div className="compose-footer">
                  <div className="compose-status">
                    <span>Draft saved locally</span>
                    <span className="status-dot">·</span>
                    <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
                  </div>
                  <button className="primary-button save-journal-button" type="submit" disabled={journalLoading}>
                    {journalLoading ? "Saving..." : "Save Journal"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {editorMode === "view" && selectedMemory && (
            <article className="journal-reading-page">
              <div className="reading-topline">
                <p>{formatDate(selectedMemory.memory_date)}</p>
                <div className="journal-menu-wrapper" ref={journalMenuRef}>
                  <button
                    className="journal-more-button"
                    onClick={() => setJournalMenuOpen((current) => !current)}
                    aria-label="Journal actions"
                  >
                    •••
                  </button>
                  {journalMenuOpen && (
                    <div className="journal-menu">
                      <button onClick={startEditing}>Edit journal</button>
                      <button onClick={startEditing}>Rename</button>
                      <button onClick={startEditing}>Change date</button>
                      <div className="journal-menu-divider" />
                      <button className="journal-menu-danger" onClick={() => deleteMemory(selectedMemory.id)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>

              <header className="reading-header">
                <p className="eyebrow">FROM YOUR PAST</p>
                <h1>{getDisplayTitle(selectedMemory)}</h1>
                {connectionJournalIds.has(selectedMemory.id) && (
                  <p className="reading-connection-mark"><span>✦</span> Past Me found a connection from this journal</p>
                )}
              </header>

              <div className="reading-rule" />
              <div className="reading-content"><p>{selectedMemory.content}</p></div>
              <footer className="reading-footer">
                <span>{countWords(selectedMemory.content)} words</span>
                <button className="text-action-button" onClick={startEditing}>Edit journal</button>
              </footer>
            </article>
          )}

          {editorMode === "edit" && selectedMemory && (
            <section className="journal-compose-page edit-compose-page">
              <div className="compose-topline">
                <input
                  className="inline-date-input"
                  type="date"
                  value={journalDate}
                  onChange={(e) => setJournalDate(e.target.value)}
                  aria-label="Journal date"
                />
                <span className="compose-hint">Editing your journal</span>
              </div>

              <form className="journal-compose-form" onSubmit={saveEditedJournal}>
                <input
                  className="compose-title-input"
                  type="text"
                  placeholder={formatDate(selectedMemory.memory_date)}
                  value={journalTitle}
                  onChange={(e) => setJournalTitle(e.target.value)}
                  maxLength={100}
                />
                <div className="compose-rule" />
                <textarea
                  className="compose-textarea"
                  value={journalContent}
                  onChange={(e) => setJournalContent(e.target.value)}
                  autoFocus
                />
                <div className="compose-footer">
                  <div className="compose-status"><span>{wordCount} {wordCount === 1 ? "word" : "words"}</span></div>
                  <div className="edit-actions">
                    <button className="secondary-button" type="button" onClick={cancelEditing}>Cancel</button>
                    <button className="primary-button" type="submit" disabled={journalLoading}>
                      {journalLoading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {editorMode === "view" && !selectedMemory && (
            <div className="workspace-empty">
              <span>✦</span>
              <h2>Your story starts here.</h2>
              <p>Create your first journal and give your future self something to come back to.</p>
              <button className="primary-button" onClick={startNewJournal}>New Journal</button>
            </div>
          )}
        </div>

        {journalMessage && <div className="workspace-message">{journalMessage}</div>}
      </section>

      {pocketNoteOpen && (
        <div className="popup-overlay soft-overlay" onMouseDown={() => setPocketNoteOpen(false)}>
          <div className="pocket-note-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setPocketNoteOpen(false)} aria-label="Close">×</button>
            <div className="pocket-note-heart">♡</div>
            <p className="eyebrow">A LITTLE NOTE FOR YOU</p>
            <blockquote>“{POCKET_NOTES[pocketNoteIndex]}”</blockquote>
            <button className="text-action-button pocket-another" onClick={anotherPocketNote}>Another note ↻</button>
            <button className="secondary-button pocket-close" onClick={() => setPocketNoteOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {showConnectionPopup && connectedMemories.length > 0 && currentConnection && (
        <div className="popup-overlay connection-overlay">
          <div className="past-popup">
            {!showPastMemory ? (
              <div className="connection-intro">
                <div className="popup-icon">✦</div>
                <p className="eyebrow">
                  {connectedMemories.length === 1
                    ? "PAST ME FOUND SOMETHING"
                    : `PAST ME FOUND ${connectedMemories.length} CONNECTIONS`}
                </p>
                <h2>
                  {connectedMemories.length === 1
                    ? "Something you wrote before connects with what you just shared."
                    : "Different parts of what you wrote connect with moments from your past."}
                </h2>
                <p className="popup-description">Would you like to hear from your past self?</p>
                <div className="popup-actions">
                  <button className="primary-button" onClick={() => setShowPastMemory(true)}>
                    {connectedMemories.length === 1 ? "Read it" : "Read them"}
                  </button>
                  <button className="secondary-button" onClick={closePopup}>Not right now</button>
                </div>
              </div>
            ) : (
              <div className="connection-reveal">
                <div className="connection-reveal-header">
                  <div>
                    <p className="eyebrow">A NOTE FROM PAST YOU</p>
                    <h2>Two moments. Your own words.</h2>
                  </div>
                  {connectedMemories.length > 1 && (
                    <span className="connection-counter">{currentConnectionIndex + 1} / {connectedMemories.length}</span>
                  )}
                </div>

                <div className="then-now-grid">
                  <section className="then-now-card">
                    <div className="then-now-label">THEN</div>
                    <p className="then-now-date">{formatDate(currentConnection.memory_date)}</p>
                    {currentConnection.title && <h3>{currentConnection.title}</h3>}
                    <blockquote>“{currentConnection.content}”</blockquote>
                  </section>

                  <div className="then-now-connector"><span>✦</span></div>

                  <section className="then-now-card now-card">
                    <div className="then-now-label">NOW</div>
                    {selectedMemory && (
                      <>
                        <p className="then-now-date">{formatDate(selectedMemory.memory_date)}</p>
                        <h3>{getDisplayTitle(selectedMemory)}</h3>
                        <blockquote>“{selectedMemory.content}”</blockquote>
                      </>
                    )}
                  </section>
                </div>

                <p className="past-memory-thought">These are your own words, written at different moments in your story.</p>

                <div className="connection-footer">
                  <div className="connection-navigation">
                    {connectedMemories.length > 1 && (
                      <>
                        <button className="secondary-button" onClick={previousConnection} disabled={currentConnectionIndex === 0}>← Previous</button>
                        <button className="secondary-button" onClick={nextConnection} disabled={currentConnectionIndex === connectedMemories.length - 1}>Next →</button>
                      </>
                    )}
                  </div>
                  <button className="primary-button" onClick={closePopup}>Close</button>
                </div>

                <button className="popup-delete-button" onClick={deleteNewMemory}>Delete the journal I just wrote</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function countWords(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned.split(/\s+/).length : 0;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function getDisplayTitle(memory: Memory) {
  return memory.title?.trim() || formatDate(memory.memory_date);
}

function getTodayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateInputValue(date: string) {
  const parsed = new Date(date);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupMemoriesByMonth(memories: Memory[]): MemoryGroup[] {
  const groups = new Map<string, MemoryGroup>();
  const now = new Date();

  for (const memory of memories) {
    const date = new Date(memory.memory_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const isCurrentMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    const label = isCurrentMonth
      ? "THIS MONTH"
      : new Intl.DateTimeFormat("en-US", {
          month: "long",
          year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
        }).format(date).toUpperCase();

    if (!groups.has(key)) groups.set(key, { key, label, memories: [] });
    groups.get(key)!.memories.push(memory);
  }

  return Array.from(groups.values());
}

export default App;
