import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Subjects from './Subjects'
import Documents from './Documents'
import AIAssistant from './AIAssistant'
import ResetPassword from './ResetPassword'
import './App.css'

function App() {
 const [page, setPage] = useState('dashboard')
const [user, setUser] = useState(null)
const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
const [authReady, setAuthReady] = useState(false)
  const [notes, setNotes] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')

  useEffect(() => {
  let active = true

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!active) return

    if (event === 'PASSWORD_RECOVERY') {
      setIsPasswordRecovery(true)
      setUser(session?.user ?? null)
      setAuthReady(true)
    } else if (
      event === 'SIGNED_IN' ||
      event === 'INITIAL_SESSION' ||
      event === 'TOKEN_REFRESHED'
    ) {
      setUser(session?.user ?? null)
      setAuthReady(true)
    } else if (event === 'SIGNED_OUT') {
      setUser(null)
      setIsPasswordRecovery(false)
      setAuthReady(true)
    }
  })

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!active) return

    setUser(session?.user ?? null)
    setAuthReady(true)
  })

  return () => {
    active = false
    subscription.unsubscribe()
  }
}, [])

useEffect(() => {
  if (user) {
    loadNotes()
    loadSubjects()
  } else {
    setNotes([])
    setSubjects([])
  }
}, [user])

  async function loadSubjects() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      alert(error.message)
      return
    }

    setSubjects(data || [])
  }

  async function loadNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    setNotes(data || [])
  }

  async function addNote() {
    if (title.trim() === '' || content.trim() === '') {
      alert('Please enter both title and content.')
      return
    }

    const { data, error } = await supabase
      .from('notes')
      .insert([
        {
          title,
          content,
          user_id: user.id,
          subject_id: selectedSubjectId || null,
        },
      ])
      .select()

    if (error) {
      alert(error.message)
      return
    }

    setNotes([data[0], ...notes])
    setTitle('')
    setContent('')
    setSelectedSubjectId('')
  }

  async function deleteNote(id) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    setNotes(notes.filter((note) => note.id !== id))
  }

  async function updateNote() {
    if (title.trim() === '' || content.trim() === '') {
      alert('Please enter both title and content.')
      return
    }

    const { data, error } = await supabase
      .from('notes')
      .update({
        title,
        content,
        subject_id: selectedSubjectId || null,
      })
      .eq('id', editingId)
      .select()

    if (error) {
      alert(error.message)
      return
    }

    setNotes(
      notes.map((note) =>
        note.id === editingId ? data[0] : note
      )
    )

    setEditingId(null)
    setTitle('')
    setContent('')
    setSelectedSubjectId('')
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  function navigate(target) {
    setPage(target)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  if (!authReady) {
  return (
    <div className="login-page">
      <div className="login-box">
        <p>Loading your workspace...</p>
      </div>
    </div>
  )
}

if (isPasswordRecovery) {
  return <ResetPassword />
}

if (!user) {
  return <Login />
}

  const userName =
    user.email?.split('@')[0] || 'Student'

  return (
    <div className="app">

      {/* ================================= */}
      {/* SIDEBAR */}
      {/* ================================= */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            🧠
          </div>

          <div>
            <div className="brand-name">
              Student
            </div>

            <div className="brand-subtitle">
              Second Brain
            </div>
          </div>

        </div>


        <div className="sidebar-section">

          <div className="sidebar-label">
            WORKSPACE
          </div>

          <button
            className={`nav-item ${
              page === 'dashboard' ? 'active' : ''
            }`}
            onClick={() => navigate('dashboard')}
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={`nav-item ${
              page === 'notes' ? 'active' : ''
            }`}
            onClick={() => navigate('notes')}
          >
            <span>✎</span>
            My Notes

            <span className="nav-count">
              {notes.length}
            </span>
          </button>

          <button
            className={`nav-item ${
              page === 'subjects' ? 'active' : ''
            }`}
            onClick={() => navigate('subjects')}
          >
            <span>▦</span>
            Subjects

            <span className="nav-count">
              {subjects.length}
            </span>
          </button>

          <button
            className={`nav-item ${
              page === 'documents' ? 'active' : ''
            }`}
            onClick={() => navigate('documents')}
          >
            <span>▤</span>
            Documents
          </button>

        </div>


        <div className="sidebar-section">

          <div className="sidebar-label">
            INTELLIGENCE
          </div>

          <button
            className={`nav-item ai-nav ${
              page === 'ai' ? 'active' : ''
            }`}
            onClick={() => navigate('ai')}
          >
            <span>✦</span>
            AI Assistant

            <span className="ai-badge">
              AI
            </span>
          </button>

        </div>


        <div className="sidebar-spacer"></div>


        <div className="sidebar-user">

          <div className="avatar">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="user-info">

            <strong>
              {userName}
            </strong>

            <span>
              Personal workspace
            </span>

          </div>

          <button
            className="logout-button"
            onClick={logout}
            title="Logout"
          >
            ↪
          </button>

        </div>

      </aside>


      {/* ================================= */}
      {/* MAIN AREA */}
      {/* ================================= */}

      <div className="main-area">

        {/* Top bar */}

        <header className="topbar">

          <div className="topbar-mobile-brand">
            🧠 Student Second Brain
          </div>

          <div className="topbar-spacer"></div>

          <div className="topbar-user">

            <div className="online-dot"></div>

            <span>
              {user.email}
            </span>

          </div>

        </header>


        {/* ================================= */}
        {/* DASHBOARD */}
        {/* ================================= */}

        {page === 'dashboard' && (

          <main className="dashboard">

            <section className="hero">

              <div className="hero-content">

                <div className="eyebrow">
                  YOUR PERSONAL KNOWLEDGE SYSTEM
                </div>

                <h1>
                  Think better.
                  <br />
                  <span>
                    Learn deeper.
                  </span>
                </h1>

                <p>
                  Your notes, subjects, documents and AI
                  assistant — all connected in one intelligent
                  study space.
                </p>

                <div className="hero-actions">

                  <button
                    className="primary-button"
                    onClick={() => navigate('notes')}
                  >
                    <span>＋</span>
                    Create a note
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => navigate('ai')}
                  >
                    <span>✦</span>
                    Ask your AI
                  </button>

                </div>

              </div>


              <div className="hero-visual">

                <div className="brain-orbit orbit-one"></div>
                <div className="brain-orbit orbit-two"></div>

                <div className="brain-glow">
                  🧠
                </div>

                <div className="floating-card floating-one">
                  <span>✦</span>
                  AI powered
                </div>

                <div className="floating-card floating-two">
                  <span>✓</span>
                  Knowledge organized
                </div>

              </div>

            </section>


            {/* Stats */}

            <section className="stats-grid">

              <div className="stat-card">

                <div className="stat-icon notes-icon">
                  ✎
                </div>

                <div>
                  <span className="stat-label">
                    NOTES
                  </span>

                  <strong>
                    {notes.length}
                  </strong>

                  <p>
                    Knowledge entries
                  </p>
                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon subject-icon">
                  ▦
                </div>

                <div>
                  <span className="stat-label">
                    SUBJECTS
                  </span>

                  <strong>
                    {subjects.length}
                  </strong>

                  <p>
                    Areas of learning
                  </p>
                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon document-icon">
                  ▤
                </div>

                <div>
                  <span className="stat-label">
                    DOCUMENTS
                  </span>

                  <strong>
                    —
                  </strong>

                  <p>
                    Study material
                  </p>
                </div>

              </div>


              <div
                className="stat-card ai-stat"
                onClick={() => navigate('ai')}
              >

                <div className="stat-icon ai-icon">
                  ✦
                </div>

                <div>
                  <span className="stat-label">
                    AI BRAIN
                  </span>

                  <strong>
                    Ready
                  </strong>

                  <p>
                    Ask your knowledge base
                  </p>
                </div>

              </div>

            </section>


            {/* AI Hero Card */}

            <section
              className="ai-hero-card"
              onClick={() => navigate('ai')}
            >

              <div className="ai-hero-glow"></div>

              <div className="ai-hero-content">

                <div className="ai-hero-label">
                  <span>✦</span>
                  YOUR SECOND BRAIN IS READY
                </div>

                <h2>
                  Ask anything about
                  <br />
                  your study material.
                </h2>

                <p>
                  Your documents are transformed into
                  searchable knowledge. Ask a question and
                  let your AI assistant find the answer.
                </p>

                <button className="ai-hero-button">
                  Open AI Assistant
                  <span>→</span>
                </button>

              </div>

              <div className="ai-hero-symbol">
                ✦
              </div>

            </section>


            {/* Quick access */}

            <section className="dashboard-section">

              <div className="section-heading">

                <div>
                  <span>
                    QUICK ACCESS
                  </span>

                  <h2>
                    Your knowledge space
                  </h2>
                </div>

              </div>


              <div className="quick-grid">

                <button
                  className="quick-card"
                  onClick={() => navigate('notes')}
                >
                  <div className="quick-icon">
                    ✎
                  </div>

                  <div>
                    <strong>
                      My Notes
                    </strong>

                    <p>
                      Write and organize ideas
                    </p>
                  </div>

                  <span className="quick-arrow">
                    →
                  </span>
                </button>


                <button
                  className="quick-card"
                  onClick={() => navigate('subjects')}
                >
                  <div className="quick-icon">
                    ▦
                  </div>

                  <div>
                    <strong>
                      Subjects
                    </strong>

                    <p>
                      Organize your learning
                    </p>
                  </div>

                  <span className="quick-arrow">
                    →
                  </span>
                </button>


                <button
                  className="quick-card"
                  onClick={() => navigate('documents')}
                >
                  <div className="quick-icon">
                    ▤
                  </div>

                  <div>
                    <strong>
                      Documents
                    </strong>

                    <p>
                      Access your study PDFs
                    </p>
                  </div>

                  <span className="quick-arrow">
                    →
                  </span>
                </button>

              </div>

            </section>

          </main>
        )}


        {/* ================================= */}
        {/* NOTES */}
        {/* ================================= */}

        {page === 'notes' && (

          <main className="notes-page">

            <button
              className="back-button"
              onClick={() => navigate('dashboard')}
            >
              ← Dashboard
            </button>


            <div className="page-heading">

              <div>

                <span className="page-eyebrow">
                  KNOWLEDGE SPACE
                </span>

                <h1>
                  My Notes
                </h1>

                <p>
                  Capture ideas, concepts and things worth
                  remembering.
                </p>

              </div>

              <div className="page-count">
                {notes.length}
                <span>
                  notes
                </span>
              </div>

            </div>


            <section className="note-editor">

              <div className="editor-title">

                <div className="editor-icon">
                  {editingId ? '✎' : '＋'}
                </div>

                <div>
                  <h2>
                    {editingId
                      ? 'Edit your note'
                      : 'Create a new note'}
                  </h2>

                  <p>
                    Turn your thoughts into searchable
                    knowledge.
                  </p>
                </div>

              </div>


              <input
                type="text"
                placeholder="Give your note a meaningful title..."
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
              />


              <select
                value={selectedSubjectId}
                onChange={(event) =>
                  setSelectedSubjectId(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Choose a subject
                </option>

                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                  >
                    {subject.name}
                  </option>
                ))}
              </select>


              <textarea
                placeholder="Start writing your knowledge..."
                value={content}
                onChange={(event) =>
                  setContent(event.target.value)
                }
              />


              <div className="editor-footer">

                <span>
                  Your note will be saved securely.
                </span>

                <button
                  className="save-button"
                  onClick={
                    editingId
                      ? updateNote
                      : addNote
                  }
                >
                  {editingId
                    ? '✓ Update note'
                    : 'Save note →'}
                </button>

              </div>

            </section>


            <section className="notes-list">

              <div className="notes-list-header">

                <div>
                  <span>
                    YOUR KNOWLEDGE
                  </span>

                  <h2>
                    Recent notes
                  </h2>
                </div>

                <span className="notes-count">
                  {notes.length}{' '}
                  {notes.length === 1
                    ? 'note'
                    : 'notes'}
                </span>

              </div>


              {notes.length === 0 ? (

                <div className="empty-notes">

                  <div className="empty-icon">
                    ✎
                  </div>

                  <h3>
                    Your knowledge starts here
                  </h3>

                  <p>
                    Create your first note and begin
                    building your Second Brain.
                  </p>

                </div>

              ) : (

                <div className="notes-grid">

                  {notes.map((note) => (

                    <article
                      className="note-card"
                      key={note.id}
                    >

                      <div className="note-card-accent"></div>

                      <div className="note-card-top">

                        <div className="note-card-icon">
                          ✎
                        </div>

                        <div className="note-actions">

                          <button
                            className="edit-button"
                            onClick={() => {
                              setEditingId(note.id)
                              setTitle(note.title)
                              setSelectedSubjectId(
                                note.subject_id || ''
                              )
                              setContent(note.content)
                            }}
                          >
                            ✎
                          </button>

                          <button
                            className="delete-button"
                            onClick={() =>
                              deleteNote(note.id)
                            }
                          >
                            ×
                          </button>

                        </div>

                      </div>


                      <h3>
                        {note.title}
                      </h3>


                      <p>
                        {note.content}
                      </p>


                      <div className="note-card-footer">

                        {note.subject_id ? (
                          <span className="note-subject">
                            ▦{' '}
                            {
                              subjects.find(
                                (subject) =>
                                  subject.id ===
                                  note.subject_id
                              )?.name
                            }
                          </span>
                        ) : (
                          <span className="note-subject muted">
                            General note
                          </span>
                        )}

                      </div>

                    </article>

                  ))}

                </div>

              )}

            </section>

          </main>
        )}


        {/* ================================= */}
        {/* OTHER PAGES */}
        {/* ================================= */}

        {page === 'subjects' && (
          <div className="page-wrapper">
            <Subjects />
          </div>
        )}

        {page === 'documents' && (
          <div className="page-wrapper">
            <Documents />
          </div>
        )}

        {page === 'ai' && (
          <div className="page-wrapper">
            <AIAssistant />
          </div>
        )}

      </div>

    </div>
  )
}

export default App