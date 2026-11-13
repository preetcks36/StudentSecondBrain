
import { useState } from 'react'
import { supabase } from './supabaseClient'

function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    setMessage('')
    setError('')

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Password updated successfully! You can now log in.')

    setPassword('')
    setConfirmPassword('')

    setTimeout(() => {
      window.location.href = '/'
    }, 2500)
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleSubmit}>
        <div className="login-logo">🔐</div>

        <h1>Set New Password</h1>

        <p>Create a new password for your Student Second Brain account.</p>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
        />

        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={6}
        />

        {error && (
          <p className="reset-error">{error}</p>
        )}

        {message && (
          <p className="reset-success">{message}</p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password →'}
        </button>
      </form>
    </div>
  )
}

export default ResetPassword
