import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function AIAssistant() {
    const [documents, setDocuments] = useState([])
    const [question, setQuestion] = useState('')
    const [answer, setAnswer] = useState('')
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
            alert('Please enter a question.')
            return
        }

        setSearching(true)
        setAnswer('')

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('Please login first.')
            }

            const response = await fetch(
                `${API_URL}/api/ai/search`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        question: question.trim(),
                    }),
                }
            )

            let data = {}

            try {
                data = await response.json()
            } catch {
                // Some server errors may not return JSON.
            }

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    data.detail ||
                    'AI request failed. Please try again.'
                )
            }

            setAnswer(
                data.answer || 'No answer was generated.'
            )
        } catch (error) {
            console.error('AI request error:', error)

            alert(
                `AI request failed:\n\n${error.message}`
            )
        } finally {
            setSearching(false)
        }
    }

    function formatBoldText(text) {
        const parts = text.split('**')

        return parts.map((part, index) => {
            if (index % 2 === 1) {
                return (
                    <strong key={index}>
                        {part}
                    </strong>
                )
            }

            return (
                <span key={index}>
                    {part}
                </span>
            )
        })
    }

    function formatAnswer(text) {
        if (!text) {
            return null
        }

        return text.split('\n').map((line, index) => {
            const trimmedLine = line.trim()

            if (!trimmedLine) {
                return (
                    <div
                        key={index}
                        className="answer-space"
                    />
                )
            }

            if (trimmedLine.startsWith('### ')) {
                return (
                    <h4 key={index}>
                        {trimmedLine.substring(4)}
                    </h4>
                )
            }

            if (trimmedLine.startsWith('## ')) {
                return (
                    <h3 key={index}>
                        {trimmedLine.substring(3)}
                    </h3>
                )
            }

            if (trimmedLine.startsWith('# ')) {
                return (
                    <h3 key={index}>
                        {trimmedLine.substring(2)}
                    </h3>
                )
            }

            if (
                trimmedLine.startsWith('- ') ||
                trimmedLine.startsWith('* ')
            ) {
                return (
                    <div
                        key={index}
                        className="answer-bullet"
                    >
                        <span>•</span>
                        <span>
                            {formatBoldText(
                                trimmedLine.substring(2)
                            )}
                        </span>
                    </div>
                )
            }

            const numberedMatch =
                trimmedLine.match(/^(\d+)\.\s+(.+)/)

            if (numberedMatch) {
                return (
                    <div
                        key={index}
                        className="answer-number"
                    >
                        <strong>
                            {numberedMatch[1]}.
                        </strong>

                        <span>
                            {formatBoldText(
                                numberedMatch[2]
                            )}
                        </span>
                    </div>
                )
            }

            return (
                <p key={index}>
                    {formatBoldText(trimmedLine)}
                </p>
            )
        })
    }

    return (
        <main className="ai-page">

            <div className="ai-header">
                <p className="small-text">
                    STUDY ASSISTANT
                </p>

                <h2>🤖 AI Assistant</h2>

                <p>
                    Ask questions about your study material.
                </p>
            </div>

            <section className="ai-box">

                <textarea
                    placeholder="Ask something about your study material..."
                    value={question}
                    onChange={(event) =>
                        setQuestion(event.target.value)
                    }
                />

                <button
                    onClick={askAI}
                    disabled={searching}
                >
                    {searching
                        ? '🤔 Thinking...'
                        : '🤖 Ask AI'}
                </button>

            </section>

            <section className="ai-answer">

                <div className="ai-answer-icon">
                    🤖
                </div>

                <h3>AI Answer</h3>

                {searching ? (
                    <div className="ai-loading">

                        <p>
                            🔎 Searching your study material...
                        </p>

                        <p>
                            🤖 Preparing your answer...
                        </p>

                        <div className="loading-bar">
                            <div></div>
                        </div>

                    </div>
                ) : answer === '' ? (

                    <p>
                        Ask a question to get an answer
                        from your study material.
                    </p>

                ) : (

                    <div className="ai-final-answer">
                        {formatAnswer(answer)}
                    </div>

                )}

            </section>

            <section className="ai-documents">

                <h3>
                    📄 Available Study Documents
                </h3>

                {documents.length === 0 ? (

                    <p>
                        No study documents uploaded yet.
                    </p>

                ) : (

                    <div className="ai-document-list">

                        {documents.map((document) => (
                            <div
                                className="ai-document-item"
                                key={document.id}
                            >

                                <span>📄</span>

                                <span>
                                    {document.name}
                                </span>

                            </div>
                        ))}

                    </div>

                )}

            </section>

        </main>
    )
}

export default AIAssistant