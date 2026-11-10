"use client";
import { useActionState, useEffect, useRef } from "react";
import { commentAction } from "@/app/actions";
import Submit from "@/components/Submit";

export default function CommentForm({ id }: { id: string }) {
  const [state, action] = useActionState(commentAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="decide" style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <input type="hidden" name="id" value={id} />
      <textarea className="textarea" name="text" placeholder="Napisz wiadomość do uczestników zlecenia…" style={{ minHeight: 80 }} required aria-label="Wiadomość" />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {state?.error && <span className="alert" role="alert">{state.error}</span>}
        <Submit className="btn btn-sm" pendingText="Wysyłanie…">Wyślij wiadomość</Submit>
      </div>
    </form>
  );
}
