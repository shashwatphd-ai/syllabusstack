import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InviteValidation {
  valid: boolean;
  email: string;
  token: string;
  inviter_id: string;
}

export function useInviteToken(token: string | null) {
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const validate = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'accept-instructor-invite?action=validate',
          {
            method: 'POST',
            body: { token },
          }
        );

        if (fnError) {
          setError('Invalid or expired invitation link.');
          return;
        }

        if (data?.valid) {
          setValidation(data);
        } else {
          setError('This invitation is no longer valid.');
        }
      } catch {
        setError('Failed to validate invitation.');
      } finally {
        setIsLoading(false);
      }
    };

    validate();
  }, [token]);

  const acceptInvite = async (userToken: string) => {
    if (!token) return { error: 'No invite token' };

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'accept-instructor-invite',
        {
          method: 'POST',
          body: { token },
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (fnError) return { error: fnError.message };
      return { data };
    } catch (err: any) {
      return { error: err.message || 'Failed to accept invitation' };
    }
  };

  return { validation, isLoading, error, acceptInvite };
}
