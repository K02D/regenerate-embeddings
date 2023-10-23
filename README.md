# regenerate-embeddings

GitHub Action to regenerate OpenAI word embeddings on every push and store them in Supabase

## Inputs

### `github-personal-access-token`

**Required** Github personal access token

### `openai-api-key`

**Required** Supabase anon key

### `supabase-database-password`

**Required** Supabase database password

### `supabase-url`

**Required** Supabase url

### `repository-owner-username`

**Required** GitHub username of the repository owner

### `repository-name`

**Required** Name of the repository

### `path-to-contents`

**Required** Path to the directory containing notes content

### `directory-structure`

**Required** Either 'nested' or flat'.

'nested': `path-to-contents` points to a list of directories.

'flat': `path-to-contents` points to a list of files

## Example usage

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
          supabase-database-password: ${{ secrets.SUPABASE_DATABASE_PASSWORD }}
          supabase-url: ${{ secrets.SUPABASE_URL }}
```
