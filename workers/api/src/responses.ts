export function reply(status: number, body: Record<string, unknown>, requestId: string): Response {
  return Response.json({ ...body, requestId }, {
    status, headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
    },
  });
}

