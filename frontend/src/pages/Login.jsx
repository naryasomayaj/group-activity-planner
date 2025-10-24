import { Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

function Login() {
    return(
        <>
            <h2>Login</h2>
            <LoginForm/>
            <p>Don't have an account?</p>
            <Link to="/signup">Sign up here</Link>
        </>
    )
}

export default Login