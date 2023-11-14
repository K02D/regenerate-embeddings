# regenerate-embeddings

GitHub Action to regenerate OpenAI word embeddings and store them in a Supabase vector store via LangChain. Useful if you have a retrieval-augmented generation (RAG) system and want to update the word embeddings automatically when the knowledge base changes.

## Inputs

### `github-personal-access-token`

**Required** Github personal access token

### `openai-api-key`

**Required** OpenAI API key

### `supabase-anon-key`

**Required** Supabase anon key

### `supabase-url`

**Required** Supabase url

### `repository-owner-username`

**Required** GitHub username of the repository owner

### `repository-name`

**Required** Name of the repository

### `path-to-contents`

**Required** Path to the directory containing notes content relative to the root path

### `directory-structure`

**Required** Either `nested` or `flat`

`nested`: `path-to-contents` points to a list of directories

`flat`: `path-to-contents` points to a list of files

<br>

**Note: please have `github-personal-access-token`, `openai-api-key`, `supabase-anon-key` and `supabase-url` defined as environment variables. See the section below**

## Example usage

1. On the GitHub repository you're adding this action to, go to Settings > Environments and create a new environment called `Dev`
2. Add environment variables to the `Dev` environment by following [these instructions](https://docs.github.com/en/actions/learn-github-actions/variables#creating-configuration-variables-for-an-environment)
3. Create a `.github/workflows` directory in the root of the project
4. In `.github/workflows`, create a file called `regenerate-embeddings.yml`
5. Copy the following YAML into `regenerate-embeddings.yml`

[Reference](https://docs.github.com/en/actions/quickstart)

```yaml
name: Regenerate embeddings
run-name: Regenerate embeddings and store in Supabase
on: [push]
jobs:
  regenerate-embeddings:
    runs-on: ubuntu-latest
    environment: Dev
    steps:
      - name: Regenerate embeddings (flat notes)
        uses: K02D/regenerate-embeddings@v2.3
        with:
          repository-owner-username: "K02D"
          repository-name: "retrieval-augmented-generation"
          path-to-contents: "notes_flat"
          directory-structure: "flat"
          github-personal-access-token: ${{ secrets.GH_PERSONAL_ACCESS_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          supabase-anon-key: ${{ secrets.SUPABASE_ANON_KEY }}
          supabase-url: ${{ secrets.SUPABASE_URL }}
```

This YAML

1. Assumes the environment variables added in step 2 are named `GH_PERSONAL_ACCESS_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_ANON_KEY`, and `SUPABASE_URL`
2. Triggers the action on every push to the `main` branch

## Pre-requisites

1. Create an OpenAI API key [here](https://platform.openai.com/account/api-keys) if you don't have one. Use this for `OPENAI_API_KEY`

   - OpenAI's API is used to generate the [word embeddings](https://platform.openai.com/docs/guides/embeddings/what-are-embeddings)

2. Create a supabase project [here](https://supabase.com/dashboard/projects) if you don't have one. Once created, go to Project Settings > API to get the project URL and anon api key. Use these for `SUPABASE_URL` and `SUPABASE_ANON_KEY`

   - Supabase is used to store the word embeddings in a [postgres vector database](https://supabase.com/docs/guides/ai) so relevant content is retrieved when a user enters a prompt. This relevant content augments the LLM's response

3. Initialize your database in your supabase project using LangChain's template ([ref](https://supabase.com/docs/guides/ai/langchain?database-method=dashboard)). On your project dashboard, go to SQL Editor > Quickstarts > LangChain and click RUN
