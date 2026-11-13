using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// =====================================================
// SUPABASE & GROQ CONFIGURATION
// =====================================================

builder.Configuration.AddUserSecrets<Program>();

var supabaseUrl = builder.Configuration["Supabase:Url"];
var supabaseKey = builder.Configuration["Supabase:Key"];
var groqApiKey = builder.Configuration["Groq:ApiKey"];
var groqModel = builder.Configuration["Groq:Model"] ?? "openai/gpt-oss-120b";
var frontendUrl = builder.Configuration["Frontend:Url"] ?? "http://localhost:5173";

if (string.IsNullOrWhiteSpace(supabaseUrl) ||
    string.IsNullOrWhiteSpace(supabaseKey))
{
    throw new Exception("Supabase configuration is missing.");
}

if (string.IsNullOrWhiteSpace(groqApiKey))
{
    throw new Exception("Groq API key is missing. Set Groq:ApiKey in User Secrets or Environment Variables.");
}


// =====================================================
// SERVICES
// =====================================================

builder.Services.AddHttpClient();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", frontendUrl.TrimEnd('/'))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


// =====================================================
// BUILD APP
// =====================================================

var app = builder.Build();

app.UseCors("Frontend");


// =====================================================
// HTTP CLIENT
// =====================================================

var httpClient = new HttpClient();


// =====================================================
// HOME
// =====================================================

app.MapGet("/", () =>
{
    return "Student Second Brain Backend is running!";
});


// =====================================================
// SUPABASE CONFIG TEST
// =====================================================

app.MapGet("/api/config-test", () =>
{
    return Results.Ok(new
    {
        message = "Supabase and Groq configuration loaded successfully."
    });
});


// =====================================================
// GROQ AI TEST
// =====================================================

app.MapGet("/api/ai/test", async (
    IHttpClientFactory httpClientFactory) =>
{
    var client = httpClientFactory.CreateClient();

    var groqRequest = new
    {
        model = groqModel,
        messages = new[]
        {
            new { role = "user", content = "Say hello to Student Second Brain in one sentence." }
        }
    };

    using var httpMessage = new HttpRequestMessage(
        HttpMethod.Post,
        "https://api.groq.com/openai/v1/chat/completions"
    );
    httpMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", groqApiKey);
    httpMessage.Content = JsonContent.Create(groqRequest);

    var response = await client.SendAsync(httpMessage);

    if (!response.IsSuccessStatusCode)
    {
        var errorText = await response.Content.ReadAsStringAsync();
        return Results.Problem($"Groq request failed: {errorText}");
    }

    var result = await response.Content.ReadFromJsonAsync<GroqChatResponse>();
    var reply = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response.";

    return Results.Ok(new { response = reply });
});


// =====================================================
// AI SEARCH + RAG
// =====================================================

app.MapPost("/api/ai/search", async (
    SearchRequest request,
    HttpRequest httpRequest) =>
{
    // =================================================
    // CHECK QUESTION
    // =================================================

    if (string.IsNullOrWhiteSpace(request.Question))
    {
        return Results.BadRequest(new
        {
            error = "Question is required."
        });
    }


    // =================================================
    // GET SUPABASE ACCESS TOKEN
    // =================================================

    var accessToken =
        httpRequest.Headers.Authorization
            .ToString()
            .Replace("Bearer ", "");

    if (string.IsNullOrWhiteSpace(accessToken))
    {
        return Results.Unauthorized();
    }


    // =================================================
    // 1. GENERATE QUESTION EMBEDDING
    // =================================================

    var embeddingRequest = new
    {
        input = request.Question
    };

    var embeddingHttpRequest =
        new HttpRequestMessage(
            HttpMethod.Post,
            $"{supabaseUrl}/functions/v1/generate-embedding"
        );

    embeddingHttpRequest.Headers.Add(
        "apikey",
        supabaseKey
    );

    embeddingHttpRequest.Headers.Add(
        "Authorization",
        $"Bearer {accessToken}"
    );

    embeddingHttpRequest.Content =
        JsonContent.Create(embeddingRequest);

    var embeddingResponse =
        await httpClient.SendAsync(
            embeddingHttpRequest
        );

    if (!embeddingResponse.IsSuccessStatusCode)
    {
        var errorText =
            await embeddingResponse.Content
                .ReadAsStringAsync();

        return Results.Problem(
            $"Embedding request failed: {errorText}"
        );
    }

    var embeddingResult =
        await embeddingResponse.Content
            .ReadFromJsonAsync<EmbeddingResponse>();

    if (embeddingResult?.Embedding == null)
    {
        return Results.Problem(
            "No embedding was returned."
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

    var searchHttpRequest =
        new HttpRequestMessage(
            HttpMethod.Post,
            $"{supabaseUrl}/rest/v1/rpc/match_document_chunks"
        );

    searchHttpRequest.Headers.Add(
        "apikey",
        supabaseKey
    );

    searchHttpRequest.Headers.Add(
        "Authorization",
        $"Bearer {accessToken}"
    );

    searchHttpRequest.Content =
        JsonContent.Create(searchBody);

    var searchResponse =
        await httpClient.SendAsync(
            searchHttpRequest
        );

    if (!searchResponse.IsSuccessStatusCode)
    {
        var errorText =
            await searchResponse.Content
                .ReadAsStringAsync();

        return Results.Problem(
            $"Semantic search failed: {errorText}"
        );
    }

    var matches =
        await searchResponse.Content
            .ReadFromJsonAsync<List<DocumentMatch>>();


    // =================================================
    // 3. PREPARE DOCUMENT CONTEXT
    // =================================================

    var context = string.Join(
        "\n\n--- DOCUMENT CHUNK ---\n\n",
        (matches ?? new List<DocumentMatch>())
            .Select(match => match.Content)
            .Where(content =>
                !string.IsNullOrWhiteSpace(content))
    );


    // =================================================
    // 4. CREATE AI PROMPT
    // =================================================

    var prompt = $"""
You are the AI assistant for Student Second Brain.

Answer the user's question using ONLY the study material provided below.

If the answer cannot be found in the study material, say:

"I couldn't find this information in your uploaded study material."

Do not invent facts.

Keep the answer clear, simple, and useful for a student.

USER QUESTION:
{request.Question}

STUDY MATERIAL:
{context}
""";


    // =================================================
    // 5. SEND CONTEXT TO GROQ CLOUD API
    // =================================================

    var groqRequest = new
    {
        model = groqModel,
        messages = new[]
        {
            new { role = "user", content = prompt }
        }
    };

    using var groqHttpMessage = new HttpRequestMessage(
        HttpMethod.Post,
        "https://api.groq.com/openai/v1/chat/completions"
    );
    groqHttpMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", groqApiKey);
    groqHttpMessage.Content = JsonContent.Create(groqRequest);

    var groqResponse = await httpClient.SendAsync(groqHttpMessage);

    if (!groqResponse.IsSuccessStatusCode)
    {
        var errorText =
            await groqResponse.Content
                .ReadAsStringAsync();

        return Results.Problem(
            $"Groq request failed: {errorText}"
        );
    }


    // =================================================
    // 6. READ GROQ ANSWER
    // =================================================

    var groqResult =
        await groqResponse.Content
            .ReadFromJsonAsync<GroqChatResponse>();

    var answerText =
        groqResult?.Choices?.FirstOrDefault()?.Message?.Content
        ?? "No answer generated.";


    // =================================================
    // 7. RETURN FINAL AI ANSWER
    // =================================================

    return Results.Ok(new
    {
        question = request.Question,
        answer = answerText,
        matches = matches ?? new List<DocumentMatch>()
    });
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