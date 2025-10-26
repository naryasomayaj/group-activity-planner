import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
//import './App.css'
/* Simplified version of the frontend written by Ben */
/* Originally, I wrote a fancier frontend, but this should be clearer for others to work with */

import SinglePage from './pages/SinglePage.jsx'

function App() {
  return (
    <>
      <SinglePage />
    </>
  )
}

export default App
