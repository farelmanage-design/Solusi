import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function getStateId(request) {
  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  return url.searchParams.get('id') || 'main';
}

async function ensureTable() {
  await sql`
    create table if not exists app_state (
      id text primary key,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
}

export default async function handler(request, response) {
  if (!process.env.DATABASE_URL) {
    sendJson(response, 503, { error: 'DATABASE_URL belum diatur di Vercel.' });
    return;
  }

  try {
    await ensureTable();
    const id = getStateId(request);

    if (request.method === 'GET') {
      const rows = await sql`
        select data, updated_at
        from app_state
        where id = ${id}
        limit 1
      `;

      if (rows.length === 0) {
        await sql`
          insert into app_state (id, data)
          values (${id}, '{}'::jsonb)
          on conflict (id) do nothing
        `;
        sendJson(response, 200, { id, data: {}, updatedAt: '' });
        return;
      }

      sendJson(response, 200, {
        id,
        data: rows[0].data || {},
        updatedAt: rows[0].updated_at?.toISOString?.() || String(rows[0].updated_at)
      });
      return;
    }

    if (request.method === 'PUT') {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
      }

      const parsed = body ? JSON.parse(body) : {};
      const nextId = parsed.id || id;
      const nextData = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};

      const rows = await sql`
        insert into app_state (id, data, updated_at)
        values (${nextId}, ${JSON.stringify(nextData)}::jsonb, now())
        on conflict (id)
        do update set data = excluded.data, updated_at = now()
        returning updated_at
      `;

      sendJson(response, 200, {
        id: nextId,
        ok: true,
        updatedAt: rows[0].updated_at?.toISOString?.() || String(rows[0].updated_at)
      });
      return;
    }

    response.setHeader('Allow', 'GET, PUT');
    sendJson(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Database error', detail: error.message });
  }
}
