import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Mock Firebase auth
vi.mock('../firebase', () => ({
    auth: {
        currentUser: null,
        onAuthStateChanged: vi.fn()
    }
}))

vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: vi.fn()
}))

import LoginForm from '../components/LoginForm'

describe('LoginForm', () => {
    const renderLoginForm = () => {
        return render(
            <BrowserRouter>
                <LoginForm />
            </BrowserRouter>
        )
    }

    it('should render email input field', () => {
        renderLoginForm()
        const emailInput = screen.getByRole('textbox')
        expect(emailInput).toBeInTheDocument()
        expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('should render password input field', () => {
        const { container } = renderLoginForm()
        const passwordInput = container.querySelector('input[type="password"]')
        expect(passwordInput).toBeInTheDocument()
    })

    it('should render login button', () => {
        renderLoginForm()
        const loginButton = screen.getByRole('button', { name: /login/i })
        expect(loginButton).toBeInTheDocument()
    })
})
