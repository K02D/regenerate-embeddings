import { Octokit } from "@octokit/core";
import {
  supabase,
  textSplitter,
  vectorStore,
  pathToContents,
  githubPersonalAccessToken,
  repositoryOwnerUsername,
  repositoryName,
  fileFormat,
} from "./client.js";
import cheerio from "cheerio";
import path from "path";
import pkg from "pdfjs-dist";
import pdfJS from "pdfjs-dist/build/pdf.js";
import PDFJSWorker from "pdfjs-dist/build/pdf.worker.entry";

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

async function main() {
  await deleteAllRows();

  console.log("Getting directories from github...");
  console.log(`Getting content from ${pathToContents}`);
  const basePath = `/repos/${repositoryOwnerUsername}/${repositoryName}/contents/`;
  const notes = await getGithubDirectory(`${basePath}${pathToContents}`); // Gets a list of directories, each containing a list of markdown files
  const markdownDirectories = [];
  for (const note of notes) {
    // Get all markdown files in each subdirectory
    const noteResponse = await getGithubDirectory(
      `${basePath}${pathToContents}/${note.name}`
    );
    markdownDirectories.push(noteResponse);
  }
  console.log("\n");

  function getTextGivenMarkdownBase64(base64encodedText) {
    const decodedText = Buffer.from(
      base64encodedText.content,
      "base64"
    ).toString("utf-8");
    // Remove html tags using cheerio
    const $ = cheerio.load(decodedText);
    const cleanText = $.text();
    return cleanText;
  }

  async function getTextGivenPDFBase64(base64encodedText) {
    const binaryData = atob(base64encodedText.content);
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

  console.log("Adding file embeddings to supabase vector store...");
  const docs = [];
  for (const dir of markdownDirectories) {
    for (const file of dir) {
      const base64encodedText = await getGithubDirectory(
        `${basePath}${file.path}`
      );
      let cleanText;
      if (path.extname(file.name) == ".md") {
        cleanText = getTextGivenMarkdownBase64(base64encodedText);
      } else if (path.extname(file.name) == ".pdf") {
        cleanText = await getTextGivenPDFBase64(base64encodedText);
      }
      const docsForCurrentDir = await textSplitter.createDocuments([cleanText]);
      docs.push(...docsForCurrentDir);
    }
  }
  vectorStore.addDocuments(docs);
  console.log(`Added ${docs.length} file embeddings to supabase vector store`);
}

main();
