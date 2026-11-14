# =====================================================
# BUILD STAGE
# =====================================================

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Copy project file and restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy the remaining source code
COPY . ./

# Publish the application
RUN dotnet publish -c Release -o /app/publish


# =====================================================
# RUNTIME STAGE
# =====================================================

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

COPY --from=build /app/publish .


# =====================================================
# SERVER CONFIGURATION
# =====================================================

# The hosting platform provides PORT.
# Default to 8080 for local Docker use.
ENV PORT=8080

EXPOSE 8080


# =====================================================
# START APPLICATION
# =====================================================

ENTRYPOINT ["sh", "-c", "dotnet backend.dll --urls http://0.0.0.0:${PORT}"]