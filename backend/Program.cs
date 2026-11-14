using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// =====================================================
// CONFIGURATION
// =====================================================

builder.Configuration.AddUserSecrets<Program>();

var supabaseUrl = builder.Configuration["Supabase:Url"];
var supabaseKey = builder.Configuration["Supabase:Key"];
var groqApiKey = builder.Configuration["Groq:ApiKey"];
var groqModel = builder.Configuration["Groq:Model"] ?? "openai/gpt-oss-120b";
var frontendUrl = builder.Configuration["Frontend:Url"] ?? "http://localhost:5173";

if (string.IsNullOrWhiteSpace(supabaseUrl))
    throw new Exception("Supabase:Url configuration is missing.");

if (string.IsNullOrWhiteSpace(supabaseKey))
    throw new Exception("Supabase:Key configuration is missing.");

if (string.IsNullOrWhiteSpace(groqApiKey))
    throw new Exception("Groq:ApiKey configuration is missing.");


// =====================================================
// SERVICES
// =====================================================

builder.Services.AddHttpClient();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                frontendUrl.TrimEnd('/')
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


// =====================================================
// BUILD APPLICATION
// =====================================================

var app = builder.Build();

app.UseCors("Frontend");


// =====================================================
// HOME ENDPOINT
// =====================================================

app.MapGet("/", () =>
{
    return Results.Ok(new
    {
        message = "Student Second Brain Backend is running!"
    });
});


// =====================================================
// AI SEARCH + RAG + LIVE WEB SEARCH
// =====================================================

app.MapPost("/api/ai/search", async (
    SearchRequest request,
    HttpRequest httpRequest,
    IHttpClientFactory httpClientFactory) =>
{
    try
    {
        // Validate the question
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            return Results.BadRequest(new
            {
                error = "Question is required."
            });
        }

        // Get Supabase user access token
        var authorizationHeader =
            httpRequest.Headers.Authorization.ToString();

        if (string.IsNullOrWhiteSpace(authorizationHeader) ||
            !authorizationHeader.StartsWith("Bearer "))
        {
            return Results.Unauthorized();
        }

        var accessToken =
            authorizationHeader["Bearer ".Length..].Trim();

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Results.Unauthorized();
        }

        var client = httpClientFactory.CreateClient();
        var matches = new List<DocumentMatch>();

        // =================================================
        // 1. GENERATE QUESTION EMBEDDING (NON-BLOCKING FALLBACK)
        // =================================================

        var embeddingRequest = new
        {
            input = request.Question
        };

        using var embeddingHttpRequest =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"{supabaseUrl.TrimEnd('/')}/functions/v1/generate-embedding"
            );

        embeddingHttpRequest.Headers.Add("apikey", supabaseKey);
        embeddingHttpRequest.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);
        embeddingHttpRequest.Content =
            JsonContent.Create(embeddingRequest);

        var embeddingResponse =
            await client.SendAsync(embeddingHttpRequest);

        if (embeddingResponse.IsSuccessStatusCode)
        {
            var embeddingResult =
                await embeddingResponse.Content
                    .ReadFromJsonAsync<EmbeddingResponse>();

            // =================================================
            // 2. SEARCH DOCUMENT CHUNKS
            // =================================================

            if (embeddingResult?.Embedding != null &&
                embeddingResult.Embedding.Length > 0)
            {
                var searchBody = new
                {
                    query_embedding = embeddingResult.Embedding,
                    match_threshold = 0.15,
                    match_count = 5
                };

                using var searchHttpRequest =
                    new HttpRequestMessage(
                        HttpMethod.Post,
                        $"{supabaseUrl.TrimEnd('/')}/rest/v1/rpc/match_document_chunks"
                    );

                searchHttpRequest.Headers.Add("apikey", supabaseKey);
                searchHttpRequest.Headers.Authorization =
                    new AuthenticationHeaderValue("Bearer", accessToken);
                searchHttpRequest.Content =
                    JsonContent.Create(searchBody);

                var searchResponse =
                    await client.SendAsync(searchHttpRequest);

                if (searchResponse.IsSuccessStatusCode)
                {
                    matches =
                        await searchResponse.Content
                            .ReadFromJsonAsync<List<DocumentMatch>>()
                        ?? new List<DocumentMatch>();
                }
            }
        }

        // =================================================
        // 3. PREPARE STUDY MATERIAL CONTEXT
        // =================================================

        var context = string.Join(
            "\n\n--- DOCUMENT CHUNK ---\n\n",
            matches
                .Select(match => match.Content)
                .Where(content => !string.IsNullOrWhiteSpace(content))
        );

        var hasStudyMaterial = !string.IsNullOrWhiteSpace(context);

        var studyContextBlock = hasStudyMaterial
            ? $"UPLOADED STUDY MATERIAL:\n{context}"
            : "UPLOADED STUDY MATERIAL:\n(No matching excerpts found in uploaded files.)";

        // =================================================
        // 4. CREATE HYBRID PROMPT (STUDY MATERIAL + WEB)
        // =================================================

        var prompt = $"""
You are the AI study assistant for Student Second Brain.

Help the student answer their question accurately and clearly:
1. First, check the UPLOADED STUDY MATERIAL below. If it contains relevant notes, definitions, or question context, use and reference them.
2. If the uploaded material only contains a question (such as a question bank) or does not contain the full answer, use the browser_search tool to search the internet and provide a complete, accurate, well-structured answer.
3. Keep the explanation clear, student-friendly, and well-formatted with bullet points or numbered steps where appropriate.

USER QUESTION:
{request.Question}

{studyContextBlock}
""";

        // =================================================
        // 5. SEND REQUEST TO GROQ WITH LIVE BROWSER SEARCH
        // =================================================

        var groqRequest = new
        {
            model = groqModel,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = prompt
                }
            },
            tools = new[]
            {
                new
                {
                    type = "browser_search"
                }
            },
            tool_choice = "auto"
        };

        using var groqHttpRequest =
            new HttpRequestMessage(
                HttpMethod.Post,
                "https://api.groq.com/openai/v1/chat/completions"
            );

        groqHttpRequest.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", groqApiKey);
        groqHttpRequest.Content =
            JsonContent.Create(groqRequest);

        var groqResponse =
            await client.SendAsync(groqHttpRequest);

        if (!groqResponse.IsSuccessStatusCode)
        {
            var errorText =
                await groqResponse.Content.ReadAsStringAsync();

            return Results.Problem(
                "Groq request failed: " + errorText,
                statusCode: (int)groqResponse.StatusCode
            );
        }

        // =================================================
        // 6. READ AI ANSWER & RETURN RESPONSE
        // =================================================

        var groqResult =
            await groqResponse.Content
                .ReadFromJsonAsync<GroqChatResponse>();

        var answerText =
            groqResult?.Choices?
                .FirstOrDefault()?
                .Message?
                .Content
            ?? "No answer generated.";

        return Results.Ok(new
        {
            question = request.Question,
            answer = answerText,
            sourceType = hasStudyMaterial ? "hybrid" : "web",
            matches
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            "An unexpected error occurred: " + ex.Message,
            statusCode: 500
        );
    }
});


// =====================================================
// START SERVER
// =====================================================

app.Run();


// =====================================================
// DATA CLASSES
// =====================================================

public class GroqChatResponse
{
    [JsonPropertyName("choices")]
    public List<GroqChoice>? Choices { get; set; }
}

public class GroqChoice
{
    [JsonPropertyName("message")]
    public GroqMessage? Message { get; set; }
}

public class GroqMessage
{
    [JsonPropertyName("content")]
    public string? Content { get; set; }
}

public class SearchRequest
{
    public string? Question { get; set; }
}

public class EmbeddingResponse
{
    public float[]? Embedding { get; set; }
}

public class DocumentMatch
{
    public string? Id { get; set; }

    public string? Document_Id { get; set; }

    public string? Content { get; set; }

    public double Similarity { get; set; }
}