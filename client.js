import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import * as core from "@actions/core";

dotenv.config();

export const fileFormat = core.getInput("file-format");
export const repositoryOwnerUsername = core.getInput(
  "repository-owner-username"
);
export const repositoryName = core.getInput("repository-name");
export const pathToContents = core.getInput("path-to-contents");
export const githubPersonalAccessToken = core.getInput(
  "github-personal-access-token"
);

const supabaseUrl = core.getInput("supabase-url");
const supabaseAnonKey = core.getInput("supabase-anon-key");
const supabaseDatabasePassword = core.getInput("supabase-database-password");
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const openAIApiKey = core.getInput("openai-api-key");
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
