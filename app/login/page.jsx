import { Suspense } from "react";
import LoginForm from "../../components/LoginForm";

export const metadata = {
  title: "Sign in | Web4Firm",
  description: "Secure sign in for the Web4Firm lead intelligence workspace.",
};

export default function LoginPage() {
  return <Suspense fallback={<main className="login-page"><section className="login-panel"><p>Loading secure sign in…</p></section></main>}><LoginForm /></Suspense>;
}
