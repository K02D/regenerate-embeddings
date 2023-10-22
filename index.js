import * as dotenv from "dotenv";
dotenv.config();
import { Octokit } from "@octokit/core";
import fetch from "node-fetch";
import { openAIApiKey } from "./client.js";
import { supabase, textSplitter, vectorStore } from "./client.js";
import cheerio from "cheerio";

const octokit = new Octokit({
  auth: process.env.GH_PERSONAL_ACCESS_TOKEN,
});

async function getGithubDirectory(path) {
  console.log(`Getting content from ${path}`);
  const response = await octokit.request(`GET ${path}`, {
    owner: "k02d",
    repo: "retrieval-augmented-generation",
    path: path,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  return response.data;
}

// Delete all rows
console.log("Deleting all rows in supabase...\n");
const { data, error } = await supabase.from("documents").delete().neq("id", 0);
if (error) {
  console.log(error);
}

console.log("Getting directories from github...");
const basePath = "/repos/k02d/retrieval-augmented-generation/contents/";
const notes = await getGithubDirectory(`${basePath}notes`); // Gets a list of directories, each containing a list of markdown files
const markdownDirectories = [];
for (const note of notes) {
  const noteResponse = await getGithubDirectory(
    `${basePath}notes/${note.name}`
  );
  markdownDirectories.push(noteResponse);
}
console.log("\n");

console.log("Adding file embeddings to supabase vector store...");
let docsAdded = 0;
for (const dir of markdownDirectories) {
  for (const file of dir) {
    const base64encodedText = await getGithubDirectory(
      `${basePath}${file.path}`
    );
    const decodedText = Buffer.from(
      base64encodedText.content,
      "base64"
    ).toString("utf-8");
    // Remove html tags using cheerio
    const $ = cheerio.load(decodedText);
    const cleanText = $.text();

    const docs = await textSplitter.createDocuments([cleanText]);
    vectorStore.addDocuments(docs);
    console.log(`Added embedding for ${file.path}`);
    docsAdded++;
  }
}
console.log(`Added ${docsAdded} file embeddings to supabase vector store`);
