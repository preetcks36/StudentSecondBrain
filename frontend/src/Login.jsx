import { useState } from 'react'
import { supabase } from './supabaseClient'

function Login() {
  const [mode, setMode] = useState('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (email.trim() === '') {
      alert('Please enter your email address.')
      return
    }

    if (mode === 'forgot') {
      await sendResetEmail()
      return
    }

    if (password === '') {
      alert('Please enter your password.')
      return
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        alert('Passwords do not match.')
        return
      }

      if (password.length < 6) {
        alert('Password must be at least 6 characters.')
        return
      }

      await signUp()
      return
    }

    await login()
  }

  async function login() {
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    window.location.reload()
  }

  async function signUp() {
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    if (data.user && !data.session) {
      alert(
        'Account created successfully! Please check your email to confirm your account.'
      )

      setMode('login')
      setPassword('')
      setConfirmPassword('')
      return
    }

    window.location.reload()
  }

  async function sendResetEmail() {
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: window.location.origin,
      }
    )

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert(
      'Password reset link has been sent to your email.'
    )

    setMode('login')
    setPassword('')
  }

  function switchMode(newMode) {
    setMode(newMode)

    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="login-page">
      <div className="login-box">

        <div className="login-logo">
          {mode === 'forgot' ? '🔐' : '🧠'}
        </div>

        <h1>
          {mode === 'forgot'
            ? 'Reset your password'
            : 'Student Second Brain'}
        </h1>

        <p>
          {mode === 'login' &&
            'Login to your personal knowledge space'}

          {mode === 'signup' &&
            'Create your personal knowledge space'}

          {mode === 'forgot' &&
            'Enter your email to receive a reset link'}
        </p>

        {mode === 'signup' && (
          <div className="signup-message">
            Start organizing your notes, subjects and
            study material in one intelligent space.
          </div>
        )}

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
        />

        {mode !== 'forgot' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />
        )}

        {mode === 'signup' && (
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? 'Please wait...'
            : mode === 'login'
              ? 'Login →'
              : mode === 'signup'
                ? 'Create account →'
                : 'Send reset link →'}
        </button>

        {mode === 'login' && (
          <>
            <button
              className="forgot-password"
              type="button"
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>

            <div className="login-switch">
              Don't have an account?

              <button
                type="button"
                onClick={() => switchMode('signup')}
              >
                Create one
              </button>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <div className="login-switch">
            Already have an account?

            <button
              type="button"
              onClick={() => switchMode('login')}
            >
              Login
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="login-switch">
            Remember your password?

            <button
              type="button"
              onClick={() => switchMode('login')}
            >
              Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default Login