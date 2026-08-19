import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.112.3';
import { ApiError } from './errors.ts';
import { supabaseServerKey, supabaseUrl } from './env.ts';

export type AdminClient = SupabaseClient;

export function createAdminClient(): AdminClient {
  return createClient(supabaseUrl(), supabaseServerKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { 'X-Client-Info': 'grace-booth-edge/1.0' },
    },
  });
}

function readBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'unauthorized', 'A valid booth session is required.');
  }

  const token = authorization.slice('Bearer '.length);
  if (token.length < 20 || token.length > 8192 || /\s/u.test(token)) {
    throw new ApiError(401, 'unauthorized', 'A valid booth session is required.');
  }

  return token;
}

export async function authenticateBooth(request: Request, admin: AdminClient): Promise<User> {
  const accessToken = readBearerToken(request);
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new ApiError(401, 'unauthorized', 'A valid booth session is required.');
  }

  const { data: device, error: deviceError } = await admin
    .from('booth_devices')
    .select('enabled')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (deviceError) {
    throw new ApiError(503, 'unavailable', 'Booth authorization is temporarily unavailable.', true);
  }
  if (!device?.enabled) {
    throw new ApiError(403, 'forbidden', 'This booth device is not enabled.');
  }

  return data.user;
}
