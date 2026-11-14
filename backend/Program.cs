using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// =====================================================
// CONFIGURATION
// =====================================================

// User Secrets work locally.
// Environment Variables work when deployed.
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
// CONFIGURATION TEST
// =====================================================

app.MapGet("/api/config-test", () =>
{
    return Results.Ok(new
    {
        message = "Backend configuration loaded successfully."
    });
});


// =====================================================
// GROQ AI TEST
// =====================================================

app.MapGet("/api/ai/test", async (
    IHttpClientFactory httpClientFactory) =>
{
    try
    {
        var client = httpClientFactory.CreateClient();

        var groqRequest = new
        {
            model = groqModel,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = "Say hello to Student Second Brain in one sentence."
                }
            }
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "https://api.groq.com/openai/v1/chat/completions"
        );

        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", groqApiKey);

        request.Content = JsonContent.Create(groqRequest);

        var response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorText = await response.Content.ReadAsStringAsync();

            return Results.Problem(
                "Groq request failed: " + errorText,
                statusCode: (int)response.StatusCode
            );
        }

        var result =
            await response.Content
                .ReadFromJsonAsync<GroqChatResponse>();

        var reply =
            result?.Choices?.FirstOrDefault()?.Message?.Content
            ?? "No response generated.";

        return Results.Ok(new { response = reply });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            "AI test failed: " + ex.Message,
            statusCode: 500
        );
    }
});


// =====================================================
// AI SEARCH + RAG
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


        // =================================================
        // 1. GENERATE QUESTION EMBEDDING
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
            new AuthenticationHeaderValue(
                "Bearer",
                accessToken
            );

        embeddingHttpRequest.Content =
            JsonContent.Create(embeddingRequest);

        var embeddingResponse =
            await client.SendAsync(embeddingHttpRequest);

        if (!embeddingResponse.IsSuccessStatusCode)
        {
            var errorText =
                await embeddingResponse.Content.ReadAsStringAsync();

            return Results.Problem(
                "Embedding request failed: " + errorText,
                statusCode: (int)embeddingResponse.StatusCode
            );
        }

        var embeddingResult =
            await embeddingResponse.Content
                .ReadFromJsonAsync<EmbeddingResponse>();

        if (embeddingResult?.Embedding == null ||
            embeddingResult.Embedding.Length == 0)
        {
            return Results.Problem(
                "No embedding was returned.",
                statusCode: 500
            );
        }


        // =================================================
        // 2. SEARCH DOCUMENT CHUNKS
        // =================================================

        var searchBody = new
        {
            query_embedding = embeddingResult.Embedding,
            match_threshold = 0.2,
            match_count = 5
        };

        using var searchHttpRequest =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"{supabaseUrl.TrimEnd('/')}/rest/v1/rpc/match_document_chunks"
            );

        searchHttpRequest.Headers.Add("apikey", supabaseKey);

        searchHttpRequest.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                accessToken
            );

        searchHttpRequest.Content =
            JsonContent.Create(searchBody);

        var searchResponse =
            await client.SendAsync(searchHttpRequest);

        if (!searchResponse.IsSuccessStatusCode)
        {
            var errorText =
                await searchResponse.Content.ReadAsStringAsync();

            return Results.Problem(
                "Semantic search failed: " + errorText,
                statusCode: (int)searchResponse.StatusCode
            );
        }

        var matches =
            await searchResponse.Content
                .ReadFromJsonAsync<List<DocumentMatch>>()
            ?? new List<DocumentMatch>();


        // =================================================
        // 3. PREPARE STUDY MATERIAL
        // =================================================

        var context = string.Join(
            "\n\n--- DOCUMENT CHUNK ---\n\n",
            matches
                .Select(match => match.Content)
                .Where(content =>
                    !string.IsNullOrWhiteSpace(content))
        );

        // No matching study material found
        if (string.IsNullOrWhiteSpace(context))
        {
            return Results.Ok(new
            {
                question = request.Question,
                answer = "I couldn't find this information in your uploaded study material.",
                matches
            });
        }


        // =================================================
        // 4. CREATE AI PROMPT
        // =================================================

        var prompt = $"""
You are the AI assistant for Student Second Brain.

Answer the user's question using ONLY the study material provided below.

If the answer cannot be found in the study material, say exactly:

"I couldn't find this information in your uploaded study material."

Do not invent facts.

Keep the answer clear, simple, and useful for a student.

USER QUESTION:
{request.Question}

STUDY MATERIAL:
{context}
""";


        // =================================================
        // 5. SEND REQUEST TO GROQ
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
            }
        };

        using var groqHttpRequest =
            new HttpRequestMessage(
                HttpMethod.Post,
                "https://api.groq.com/openai/v1/chat/completions"
            );

        groqHttpRequest.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                groqApiKey
            );

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
        // 6. READ AI ANSWER
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


        // =================================================
        // 7. RETURN RESPONSE
        // =================================================

        return Results.Ok(new
        {
            question = request.Question,
            answer = answerText,
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