import { assertEquals } from 'jsr:@std/assert@1.0.14';
import type { AdminClient } from '../_shared/supabase.ts';
import { runCleanup } from '../cleanup-expired/index.ts';

type RpcResult = { data: unknown; error: unknown };

Deno.test('cleanup leaves failures leased and advances to later batches', async () => {
  const firstBatch = Array.from({ length: 50 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    storage_object_path: `2026/08/00000000-0000-4000-8000-${String(index).padStart(12, '0')}.jpg`,
    previous_status: 'expired',
  }));
  const laterClaim = {
    id: '99999999-9999-4999-8999-999999999999',
    storage_object_path: '2026/08/99999999-9999-4999-8999-999999999999.jpg',
    previous_status: 'deleting',
  };
  const claimResults: RpcResult[] = [
    { data: firstBatch, error: null },
    { data: [laterClaim], error: null },
  ];
  const rpcNames: string[] = [];
  const removedPaths: string[] = [];

  const admin = {
    rpc(name: string): Promise<RpcResult> {
      rpcNames.push(name);
      if (name === 'claim_photo_cleanup') {
        return Promise.resolve(claimResults.shift() ?? { data: [], error: null });
      }
      if (name === 'complete_photo_cleanup') {
        return Promise.resolve({ data: null, error: { message: 'simulated completion failure' } });
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    storage: {
      from() {
        return {
          remove(paths: string[]) {
            removedPaths.push(...paths);
            return Promise.resolve({
              error: paths[0] === laterClaim.storage_object_path
                ? null
                : { message: 'simulated storage failure' },
            });
          },
        };
      },
    },
  } as unknown as AdminClient;

  const summary = await runCleanup(
    admin,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'photos',
  );

  assertEquals(summary, { claimed: 51, deleted: 0, failed: 51, hasMore: false });
  assertEquals(removedPaths.length, 51);
  assertEquals(rpcNames, [
    'claim_photo_cleanup',
    'claim_photo_cleanup',
    'complete_photo_cleanup',
  ]);
});
