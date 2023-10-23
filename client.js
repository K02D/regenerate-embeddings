import { createClient } from "@supabase/supabase-js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { getInput } from "@actions/core";

export const directoryStructure = getInput("directory-structure");
export const repositoryOwnerUsername = getInput("repository-owner-username");
export const repositoryName = getInput("repository-name");
export const pathToContents = getInput("path-to-contents");
export const githubPersonalAccessToken = getInput(
  "github-personal-access-token"
);

const supabaseUrl = getInput("supabase-url");
const supabaseAnonKey = getInput("supabase-anon-key");
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const openAIApiKey = getInput("openai-api-key");
export const vectorStore = await SupabaseVectorStore.fromExistingIndex(
  new OpenAIEmbeddings({ openAIApiKey }),
  {
    tableName: "documents",
    queryName: "match_documents",
    client: supabase,
  }
);

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 50,
});
