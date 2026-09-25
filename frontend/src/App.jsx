import './App.css'

function App() {
  return (
    <div className="app">
      <header className="navbar">
        <h1>🧠 Student Second Brain</h1>

        <button className="profile-button">
          My Profile
        </button>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <p className="small-text">YOUR PERSONAL KNOWLEDGE SPACE</p>

          <h2>Welcome to your Second Brain 👋</h2>

          <p>
            Store, organize and understand your study material in one place.
          </p>
        </section>

        <section className="search-section">
          <input
            type="text"
            placeholder="Search your notes, subjects and documents..."
          />

          <button>Search</button>
        </section>

        <section className="cards">
          <div className="card">
            <span>📝</span>
            <h3>My Notes</h3>
            <p>Create and organize your study notes.</p>
          </div>

          <div className="card">
            <span>📚</span>
            <h3>Subjects</h3>
            <p>Keep your subjects and topics organized.</p>
          </div>

          <div className="card">
            <span>📄</span>
            <h3>Documents</h3>
            <p>Store your PDFs and study material.</p>
          </div>

          <div className="card">
            <span>🤖</span>
            <h3>AI Assistant</h3>
            <p>Ask questions about your study material.</p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App