import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const model = new Supabase.ai.Session('gte-small')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

export default {
  async fetch(req: Request) {
    // Handle browser CORS request
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders,
      })
    }

    try {
      const { input } = await req.json()

      if (!input || typeof input !== 'string') {
        return Response.json(
          { error: 'input is required' },
          {
            status: 400,
            headers: corsHeaders,
          }
        )
      }

      const embedding = await model.run(input, {
        mean_pool: true,
        normalize: true,
      })

      return Response.json(
        {
          embedding,
        },
        {
          headers: corsHeaders,
        }
      )
    } catch (error) {
      console.error(error)

      return Response.json(
        {
          error: 'Failed to generate embedding',
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      )
    }
  },
}