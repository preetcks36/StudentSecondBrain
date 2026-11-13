import { useEffect, useState } from 'react'
import { extractPdfText } from './pdfExtractor'
import { supabase } from './supabaseClient'

function Documents() {
    const [documents, setDocuments] = useState([])
    const [subjects, setSubjects] = useState([])
    const [name, setName] = useState('')
    const [selectedSubjectId, setSelectedSubjectId] = useState('')
    const [file, setFile] = useState(null)
    async function generateEmbedding(text) {
        const { data, error } = await supabase.functions.invoke(
            'generate-embedding',
            {
                body: {
                    input: text,
                },
            }
        )

        if (error) {
            console.error('Embedding error:', error)
            throw new Error(error.message)
        }

        if (!data?.embedding) {
            throw new Error('No embedding returned.')
        }

        return data.embedding
    }
    useEffect(() => {
        loadDocuments()
        loadSubjects()
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

        setDocuments(data)
    }

    async function loadSubjects() {
        const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            alert(error.message)
            return
        }

        setSubjects(data)
    }

    async function uploadDocument() {
        if (!file) {
            alert('Please select a PDF file.')
            return
        }

        if (name.trim() === '') {
            alert('Please enter a document name.')
            return
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a PDF file.')
            return
        }

        const { data: userData } = await supabase.auth.getUser()
        const user = userData.user

        if (!user) {
            alert('Please login first.')
            return
        }

        // --------------------------------
        // 1. Extract PDF text
        // --------------------------------

        let extractedText = ''

        try {
            extractedText = await extractPdfText(file)

            console.log('Extracted PDF text:')
            console.log(extractedText)

            console.log(
                `Characters extracted: ${extractedText.length}`
            )
        } catch (error) {
            console.error('PDF extraction error:', error)

            alert(
                `PDF extraction failed:\n\n${error.message}`
            )

            return
        }

        if (!extractedText.trim()) {
            alert('PDF contains no extractable text.')
            return
        }

        // --------------------------------
        // 2. Upload PDF to Storage
        // --------------------------------

        const filePath =
            `${user.id}/${Date.now()}-${file.name}`

        const { error: uploadError } =
            await supabase.storage
                .from('documents')
                .upload(filePath, file)

        if (uploadError) {
            alert(uploadError.message)
            return
        }

        // --------------------------------
        // 3. Save document information
        // --------------------------------

        const { data, error } =
            await supabase
                .from('documents')
                .insert([
                    {
                        name: name,
                        file_path: filePath,
                        user_id: user.id,
                        subject_id: selectedSubjectId || null,
                    },
                ])
                .select()

        if (error) {
            // Remove uploaded file if database insert fails
            await supabase.storage
                .from('documents')
                .remove([filePath])

            alert(error.message)
            return
        }

        const documentId = data[0].id

        // --------------------------------
        // 4. Split text and generate embeddings
        // --------------------------------

        const chunkSize = 1200
        const chunks = []

        for (
            let i = 0;
            i < extractedText.length;
            i += chunkSize
        ) {
            const content = extractedText.slice(
                i,
                i + chunkSize
            )

            console.log(
                `Generating embedding for chunk ${chunks.length + 1}...`
            )

            const embedding = await generateEmbedding(content)

            chunks.push({
                document_id: documentId,
                content: content,
                embedding: embedding,
            })
        }

        console.log(
            `Created ${chunks.length} chunks with embeddings.`
        )
        // --------------------------------
        // 5. Save chunks to database
        // --------------------------------

        const { error: chunkError } =
            await supabase
                .from('document_chunks')
                .insert(chunks)

        if (chunkError) {
            console.error(
                'CHUNK SAVE ERROR:',
                chunkError
            )

            // Clean up PDF and document record
            await supabase.storage
                .from('documents')
                .remove([filePath])

            await supabase
                .from('documents')
                .delete()
                .eq('id', documentId)

            alert(
                `Chunk save failed:\n\n${chunkError.message}`
            )

            return
        }

        console.log(
            `Saved ${chunks.length} chunks successfully.`
        )

        // --------------------------------
        // 6. Update page
        // --------------------------------

        setDocuments([
            data[0],
            ...documents,
        ])

        setName('')
        setSelectedSubjectId('')
        setFile(null)

        alert(
            `Document uploaded successfully!\n\nText chunks saved: ${chunks.length}`
        )
    }

    async function openDocument(filePath) {
        const { data, error } =
            await supabase.storage
                .from('documents')
                .createSignedUrl(
                    filePath,
                    60 * 10
                )

        if (error) {
            alert(error.message)
            return
        }

        window.open(
            data.signedUrl,
            '_blank'
        )
    }

    async function deleteDocument(document) {
        const confirmDelete =
            window.confirm(
                `Delete "${document.name}"?`
            )

        if (!confirmDelete) {
            return
        }

        // Delete PDF from Storage
        const { error: storageError } =
            await supabase.storage
                .from('documents')
                .remove([
                    document.file_path,
                ])

        if (storageError) {
            alert(storageError.message)
            return
        }

        // Delete document chunks
        const { error: chunkError } =
            await supabase
                .from('document_chunks')
                .delete()
                .eq(
                    'document_id',
                    document.id
                )

        if (chunkError) {
            alert(chunkError.message)
            return
        }

        // Delete document record
        const { error: databaseError } =
            await supabase
                .from('documents')
                .delete()
                .eq('id', document.id)

        if (databaseError) {
            alert(databaseError.message)
            return
        }

        setDocuments(
            documents.filter(
                (item) =>
                    item.id !== document.id
            )
        )

        alert(
            'Document deleted successfully!'
        )
    }

    return (
        <main className="documents-page">

            <div className="documents-header">

                <p className="small-text">
                    STUDY MATERIAL
                </p>

                <h2>📄 Documents</h2>

                <p>
                    Upload and organize your study
                    documents.
                </p>

            </div>

            <section className="document-upload">

                <h3>Upload a Document</h3>

                <input
                    type="text"
                    placeholder="Document name..."
                    value={name}
                    onChange={(event) =>
                        setName(event.target.value)
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
                        Select a subject
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

                <input
                    type="file"
                    accept=".pdf"
                    onChange={(event) =>
                        setFile(
                            event.target.files[0]
                        )
                    }
                />

                <button
                    onClick={uploadDocument}
                >
                    + Upload Document
                </button>

            </section>

            <section className="documents-list">

                <div className="documents-list-header">

                    <h3>Your Documents</h3>

                    <span>
                        {documents.length}{' '}
                        document
                        {documents.length !== 1
                            ? 's'
                            : ''}
                    </span>

                </div>

                {documents.length === 0 ? (

                    <div className="empty-documents">

                        <div>📄</div>

                        <h3>
                            No documents yet
                        </h3>

                        <p>
                            Upload your first study
                            document.
                        </p>

                    </div>

                ) : (

                    <div className="documents-grid">

                        {documents.map(
                            (document) => (

                                <article
                                    className="document-card"
                                    key={document.id}
                                >

                                    <div className="document-icon">
                                        📄
                                    </div>

                                    <div>

                                        <h3>
                                            {document.name}
                                        </h3>

                                        {document.subject_id && (
                                            <p>
                                                📚{' '}
                                                {
                                                    subjects.find(
                                                        (subject) =>
                                                            subject.id ===
                                                            document.subject_id
                                                    )?.name
                                                }
                                            </p>
                                        )}

                                    </div>

                                    <button
                                        onClick={() =>
                                            openDocument(
                                                document.file_path
                                            )
                                        }
                                    >
                                        📖 Open PDF
                                    </button>

                                    <button
                                        onClick={() =>
                                            deleteDocument(
                                                document
                                            )
                                        }
                                    >
                                        🗑️ Delete
                                    </button>

                                </article>

                            )
                        )}

                    </div>

                )}

            </section>

        </main>
    )
}

export default Documents