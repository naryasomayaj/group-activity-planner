import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'
import './App.css'

import LoginForm from './components/LoginForm';
import SignupForm from './components/SignUpForm';

function App() {

  const handleCreateUser = async () => {
    const result = await createUserWithEmailAndPassword(auth, );

    await sendEmailVerification(result.user);
  }

  const handleSignIn = async () => {
    const result = await SignInWithEmailAndPassword(auth, )
  }

  return (
    <>
      <div>
        <h1>Test Form</h1>
        <h2>Sign Up</h2>
        <SignupForm />
        <h2>Login</h2>
        <LoginForm />
      </div>
    </>
  )
}

export default App
