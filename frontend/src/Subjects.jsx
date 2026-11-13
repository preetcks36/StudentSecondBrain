import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    loadSubjects()
  }, [])

  async function loadSubjects() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    setSubjects(data)
  }

  async function saveSubject() {
    if (name.trim() === '') {
      alert('Please enter a subject name.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      alert('Please login first.')
      return
    }

    if (editingId) {
      const { data, error } = await supabase
        .from('subjects')
        .update({
          name: name,
          description: description,
        })
        .eq('id', editingId)
        .select()

      if (error) {
        alert(error.message)
        return
      }

      setSubjects(
        subjects.map((subject) =>
          subject.id === editingId ? data[0] : subject
        )
      )

      setEditingId(null)
    } else {
      const { data, error } = await supabase
        .from('subjects')
        .insert([
          {
            name: name,
            description: description,
            user_id: user.id,
          },
        ])
        .select()

      if (error) {
        alert(error.message)
        return
      }

      setSubjects([data[0], ...subjects])
    }

    setName('')
    setDescription('')
  }

  function editSubject(subject) {
    setEditingId(subject.id)
    setName(subject.name)
    setDescription(subject.description || '')
  }

  async function deleteSubject(id) {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    setSubjects(subjects.filter((subject) => subject.id !== id))
  }

  return (
    <div className="subjects-page">

      <h1>📚 Subjects</h1>
      <p>Organize your learning by subject.</p>

      <div className="subject-form">

        <input
          type="text"
          placeholder="Subject name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <textarea
          placeholder="Short description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <button onClick={saveSubject}>
          {editingId ? '✓ Update Subject' : '+ Add Subject'}
        </button>

      </div>

      <div className="subjects-list">

        {subjects.map((subject) => (
          <div className="subject-card" key={subject.id}>

            <div>
              <h3>{subject.name}</h3>

              <p>
                {subject.description || 'No description'}
              </p>
            </div>

            <div className="subject-actions">

              <button
                onClick={() => editSubject(subject)}
              >
                ✏️
              </button>

              <button
                onClick={() => deleteSubject(subject.id)}
              >
                🗑️
              </button>

            </div>

          </div>
        ))}

      </div>

    </div>
  )
}

export default Subjects