import { useState, useCallback } from 'react';
import { quotesApi } from '../api/quotes';

type PdfState =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'done'; signedUrl: string }
  | { phase: 'error'; message: string };

export function usePdfGeneration(quoteId: string) {
  const [state, setState] = useState<PdfState>({ phase: 'idle' });

  const generate = useCallback(async () => {
    setState({ phase: 'generating' });
    try {
      const { job_id } = await quotesApi.generatePdf(quoteId);

      // Poll every 2 seconds
      const poll = async (): Promise<void> => {
        const result = await quotesApi.getPdfStatus(quoteId, job_id);
        if (result.status === 'done') {
          setState({ phase: 'done', signedUrl: result.signed_url });
        } else if (result.status === 'failed') {
          setState({ phase: 'error', message: result.error ?? 'PDF generation failed' });
        } else {
          await new Promise((r) => setTimeout(r, 2000));
          return poll();
        }
      };

      await poll();
    } catch {
      setState({ phase: 'error', message: 'Failed to start PDF generation' });
    }
  }, [quoteId]);

  const reset = () => setState({ phase: 'idle' });

  return { state, generate, reset };
}
