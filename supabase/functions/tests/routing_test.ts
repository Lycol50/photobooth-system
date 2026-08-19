import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.14';
import { ApiError } from '../_shared/errors.ts';
import { routeFromRequest } from '../photo/index.ts';

Deno.test('photo routing accepts only exact action paths', () => {
  assertEquals(
    routeFromRequest(new Request('https://project.example/functions/v1/photo/resolve')),
    'resolve',
  );
  assertEquals(routeFromRequest(new Request('https://project.example/photo/image')), 'image');
  assertEquals(routeFromRequest(new Request('https://project.example/photo/download')), 'download');

  for (
    const path of [
      '/photo/arbitrary/resolve',
      '/other/resolve',
      '/photo/resolve/',
      '/functions/v1/photo/resolve/extra',
    ]
  ) {
    assertThrows(
      () => routeFromRequest(new Request(`https://project.example${path}`)),
      ApiError,
    );
  }
});
