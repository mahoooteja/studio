"use client";
import { useActionState } from "react";
import { registerAction } from "@/app/actions";
import Submit from "@/components/Submit";

export default function RegisterForm({ defaultRole }: { defaultRole: "client" | "maker" }) {
  const [state, action] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="form">
      <div className="seg" role="radiogroup" aria-label="Typ konta">
        <label>
          <input type="radio" name="role" value="client" defaultChecked={defaultRole === "client"} />
          <b>Zamawiam</b>
          <span>Szukam kogoś do druku</span>
        </label>
        <label>
          <input type="radio" name="role" value="maker" defaultChecked={defaultRole === "maker"} />
          <b>Drukuję</b>
          <span>Mam drukarkę i przyjmuję zlecenia</span>
        </label>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Imię i nazwisko</label>
          <input className="input" id="name" name="name" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="city">Miasto</label>
          <input className="input" id="city" name="city" autoComplete="address-level2" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Hasło</label>
        <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        <span className="hint">Minimum 8 znaków.</span>
      </div>
      {state?.error && <div className="alert" role="alert">{state.error}</div>}
      <Submit className="btn btn-primary btn-lg" pendingText="Tworzenie konta…">Załóż konto</Submit>
    </form>
  );
}
