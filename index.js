import { Octokit } from "@octokit/core";
import {
  supabase,
  textSplitter,
  vectorStore,
  pathToContents,
  githubPersonalAccessToken,
  repositoryOwnerUsername,
  repositoryName,
  directoryStructure,
} from "./client.js";
import cheerio from "cheerio";
import path from "path";
import pkg from "pdfjs-dist";
import pdfJS from "pdfjs-dist/build/pdf.js";
import PDFJSWorker from "pdfjs-dist/build/pdf.worker.js";

pdfJS.GlobalWorkerOptions.workerSrc = PDFJSWorker;

const octokit = new Octokit({
  auth: githubPersonalAccessToken,
});

async function getGithubDirectory(path) {
  console.log(`Getting content from ${path}`);
  const response = await octokit.request(`GET ${path}`, {
    owner: repositoryOwnerUsername,
    repo: repositoryName,
    path: path,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  return response.data;
}

// Delete all rows
async function deleteAllRows() {
  console.log("Deleting all rows in supabase...");
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .neq("id", 0);
  if (error) {
    console.log(error);
  }
}

function getTextGivenMarkdownBase64(base64encodedText) {
  const decodedText = Buffer.from(base64encodedText, "base64").toString(
    "utf-8"
  );
  // Remove html tags using cheerio
  const $ = cheerio.load(decodedText);
  const cleanText = $.text();
  return cleanText;
}

async function getTextGivenPDFBase64(base64encodedText) {
  const binaryData = atob(base64encodedText);
  let uint8Array = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    uint8Array[i] = binaryData.charCodeAt(i);
  }
  const { getDocument } = pkg;

  async function extractText(pdfData) {
    let textContent = "";
    const pdf = await getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textPage = await page.getTextContent();
      textContent += textPage.items.map((item) => item.str).join(" ");
    }
    return textContent;
  }

  const text = await extractText(uint8Array);
  return text;
}

async function getFilesFromDirectory(dirContents) {
  const githubFileObjects = [];
  if (directoryStructure == "nested") {
    for (const subdir of dirContents) {
      // Get all markdown files in each subdirectory
      const noteResponse = await getGithubDirectory(
        `${basePath}${pathToContents}/${subdir.name}`
      );
      githubFileObjects.push(...noteResponse);
    }
  } else if (directoryStructure == "flat") {
    githubFileObjects.push(...dirContents);
  }
  return githubFileObjects;
}

async function main() {
  await deleteAllRows();
  console.log("Getting directories from github...");
  const basePath = `/repos/${repositoryOwnerUsername}/${repositoryName}/contents/`;
  const filesOrDirs = await getGithubDirectory(`${basePath}${pathToContents}`); // Gets a list of directories, each containing a list of markdown files
  const githubFileObjects = await getFilesFromDirectory(filesOrDirs);

  console.log("Adding file embeddings to supabase vector store...");
  const docs = [];
  for (const file of githubFileObjects) {
    const base64encodedText = await getGithubDirectory(
      `${basePath}${file.path}`
    );
    let cleanText;
    if (path.extname(file.name) == ".md") {
      cleanText = getTextGivenMarkdownBase64(base64encodedText.content);
    } else if (path.extname(file.name) == ".pdf") {
      cleanText = await getTextGivenPDFBase64(base64encodedText.content);
    }
    const docsForCurrentDir = await textSplitter.createDocuments([cleanText]);
    docs.push(...docsForCurrentDir);
  }
  vectorStore.addDocuments(docs);
  console.log(`Added ${docs.length} file embeddings to supabase vector store`);
}

main();
