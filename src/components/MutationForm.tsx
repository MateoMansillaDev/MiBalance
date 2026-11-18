'use client';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import ui from './ui.module.scss';

export type Feedback = { error: string } | { message: string };
type Props = {
  action: (form: FormData) => Promise<Feedback>;
  children?: ReactNode;
  submit: string;
  confirm?: string;
  resetOnSuccess?: boolean;
};
export function MutationForm({
  action,
  children,
  submit,
  confirm,
  resetOnSuccess,
}: Props) {
  const [feedback, setFeedback] = useState<Feedback>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const values = new FormData(event.currentTarget);
        start(async () => {
          const result = await action(values);
          setFeedback(result);
          if (resetOnSuccess && 'message' in result) ref.current?.reset();
        });
      }}
    >
      {children}
      <div>
        <button
          disabled={pending}
          className={confirm ? ui.danger : ui.secondary}
        >
          {pending ? 'Guardando…' : submit}
        </button>
      </div>
      {feedback &&
        ('error' in feedback ? (
          <p role="alert" className={ui.notice}>
            {feedback.error}
          </p>
        ) : (
          <p role="status">{feedback.message}</p>
        ))}
    </form>
  );
}
