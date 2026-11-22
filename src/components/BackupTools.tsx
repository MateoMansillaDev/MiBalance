'use client';
import { useState } from 'react';
import { currentBook, mergeIn } from '@/local/store';
import { parseDoc } from '@/local/schema';
import { today } from '@/lib/dates';
import ui from './ui.module.scss';

// Respaldo manual: un archivo JSON con el documento completo. Al restaurarlo
// se combina con lo que ya hay, igual que una sincronización.
export function BackupTools() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <div>
      <div className={ui.actions}>
        <button
          type="button"
          className={ui.secondary}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(currentBook().doc)], { type: 'application/json' }),
            );
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mibalance-respaldo-' + today() + '.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Descargar respaldo
        </button>
        <label className={ui.secondary}>
          Restaurar respaldo
          <input
            className={ui.sr}
            type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            setMessage('');
            setError('');
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 50 * 1024 * 1024) throw new Error('El archivo es demasiado grande.');
              await mergeIn(parseDoc(await file.text()));
              setMessage('Respaldo combinado con los datos de este dispositivo.');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No pudimos leer el respaldo.');
            }
            event.target.value = '';
          }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className={ui.notice}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
