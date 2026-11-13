import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

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
            alert(error.message)
            return
        }

        setDocuments(data || [])
    }

    async function askAI() {
        if (question.trim() === '') {
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
                `${import.meta.env.VITE_API_URL}/api/ai/search`,
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

            const data = await response.json()

            if (!response.ok) {
                throw new Error(
                    data.error || 'AI request failed.'
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

    function formatAnswer(text) {
        if (!text) {
            return null
        }

        const lines = text.split('\n')

        return lines.map((line, index) => {
            const trimmedLine = line.trim()

            if (trimmedLine === '') {
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

            if (/^\d+\.\s/.test(trimmedLine)) {
                const match = trimmedLine.match(
                    /^(\d+)\.\s(.+)/
                )

                if (match) {
                    return (
                        <div
                            key={index}
                            className="answer-number"
                        >
                            <strong>
                                {match[1]}.
                            </strong>

                            <span>
                                {formatBoldText(match[2])}
                            </span>
                        </div>
                    )
                }
            }

            return (
                <p key={index}>
                    {formatBoldText(trimmedLine)}
                </p>
            )
        })
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