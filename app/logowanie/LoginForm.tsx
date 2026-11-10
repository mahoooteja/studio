"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import Submit from "@/components/Submit";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="form">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Hasło</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <div className="alert" role="alert">{state.error}</div>}
      <Submit className="btn btn-primary btn-lg" pendingText="Logowanie…">Zaloguj się</Submit>
    </form>
  );
}
