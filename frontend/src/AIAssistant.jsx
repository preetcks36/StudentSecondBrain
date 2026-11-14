import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5207'

function AIAssistant() {
  const [documents, setDocuments] = useState([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [matches, setMatches] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Document loading error:', error)
      return
    }

    setDocuments(data || [])
  }

  async function askAI() {
    if (!question.trim()) {
      setErrorMessage('Please enter a question first.')
      return
    }

    setErrorMessage('')
    setSearching(true)
    setAnswer('')
    setSourceType('')
    setMatches([])

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Please login first.')
      }

      const response = await fetch(`${API_URL}/api/ai/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: question.trim(),
        }),
      })

      let data = {}

      try {
        data = await response.json()
      } catch {
        // Handle non-JSON server errors gracefully
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.detail ||
            'AI request failed. Please try again.'
        )
      }

      setAnswer(data.answer || 'No answer was generated.')
      setSourceType(data.sourceType || 'web')
      setMatches(data.matches || [])
    } catch (error) {
      console.error('AI request error:', error)
      setErrorMessage(error.message || 'AI request failed.')
    } finally {
      setSearching(false)
    }
  }

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      if (!searching) {
        askAI()
      }
    }
  }

  function formatBoldText(text) {
    const parts = text.split('**')

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index}>{part}</strong>
      }
      return <span key={index}>{part}</span>
    })
  }

  function formatAnswer(text) {
    if (!text) return null

    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim()

      if (!trimmedLine) {
        return <div key={index} className="answer-space" />
      }

      if (trimmedLine.startsWith('### ')) {
        return <h4 key={index}>{trimmedLine.substring(4)}</h4>
      }

      if (trimmedLine.startsWith('## ')) {
        return <h3 key={index}>{trimmedLine.substring(3)}</h3>
      }

      if (trimmedLine.startsWith('# ')) {
        return <h3 key={index}>{trimmedLine.substring(2)}</h3>
      }

      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        return (
          <div key={index} className="answer-bullet">
            <span>•</span>
            <span>{formatBoldText(trimmedLine.substring(2))}</span>
          </div>
        )
      }

      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/)

      if (numberedMatch) {
        return (
          <div key={index} className="answer-number">
            <strong>{numberedMatch[1]}.</strong>
            <span>{formatBoldText(numberedMatch[2])}</span>
          </div>
        )
      }

      return <p key={index}>{formatBoldText(trimmedLine)}</p>
    })
  }

  const matchedDocumentNames = Array.from(
    new Set(
      matches
        .map(
          (m) =>
            documents.find((doc) => doc.id === m.document_id)?.name
        )
        .filter(Boolean)
    )
  )

  return (
    <main className="ai-page">
      <div className="ai-header">
        <p className="small-text">STUDY ASSISTANT + LIVE WEB SEARCH</p>
        <h2>🤖 AI Assistant</h2>
        <p>
          Ask questions from your uploaded question banks, notes, or the
          wider web.
        </p>
      </div>

      <section className="ai-box">
        <textarea
          placeholder="Paste a question from your question bank or ask any study topic... (Ctrl + Enter to ask)"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        {errorMessage && (
          <p className="reset-error">{errorMessage}</p>
        )}

        <button onClick={askAI} disabled={searching}>
          {searching ? '🔎 Searching Notes & Web...' : '✦ Ask AI'}
        </button>
      </section>

      <section className="ai-answer">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="ai-answer-icon" style={{ marginBottom: 0 }}>
              🤖
            </div>
            <h3 style={{ marginBottom: 0 }}>AI Answer</h3>
          </div>

          {answer && !searching && (
            <span className="note-subject">
              {sourceType === 'hybrid'
                ? '📚 Study Material + 🌐 Live Web'
                : '🌐 Live Web Search'}
            </span>
          )}
        </div>

        {searching ? (
          <div className="ai-loading">
            <p>🔎 Checking your study material & searching the web...</p>
            <p>🤖 Synthesizing your answer...</p>
            <div className="loading-bar">
              <div />
            </div>
          </div>
        ) : answer === '' ? (
          <p>
            Ask a question to get an answer from your study material and live
            internet search.
          </p>
        ) : (
          <>
            <div className="ai-final-answer">{formatAnswer(answer)}</div>

            {matchedDocumentNames.length > 0 && (
              <div
                style={{
                  marginTop: '18px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                  }}
                >
                  REFERENCED STUDY DOCUMENTS:
                </p>
                <div className="ai-document-list">
                  {matchedDocumentNames.map((docName) => (
                    <div className="ai-document-item" key={docName}>
                      <span>📄</span>
                      <span>{docName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="ai-documents">
        <h3>📄 Available Study Documents</h3>

        {documents.length === 0 ? (
          <p>No study documents uploaded yet.</p>
        ) : (
          <div className="ai-document-list">
            {documents.map((document) => (
              <div className="ai-document-item" key={document.id}>
                <span>📄</span>
                <span>{document.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default AIAssistant