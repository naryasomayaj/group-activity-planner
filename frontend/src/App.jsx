import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css'

import NavBar from './components/NavBar.jsx'
import Home from './pages/Home.jsx';
import About from './pages/About.jsx'
import Profile from './pages/Profile.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'

function App() {
  return (
    <>
      <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
