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
import { extname } from "path";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import PDFJSWorker from "pdfjs-dist/build/pdf.worker.js";
import { load } from "cheerio";
import { Endpoints } from "@octokit/types";
import { TextItem } from "pdfjs-dist/types/src/display/api.js";

GlobalWorkerOptions.workerSrc = PDFJSWorker;

const octokit = new Octokit({
  auth: githubPersonalAccessToken,
});

type GithubGetContentsResponse =
  Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"]["data"];

async function getGithubContents(
  path: string
): Promise<GithubGetContentsResponse> {
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
async function deleteAllRows(): Promise<void> {
  console.log("Deleting all rows in supabase...");
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .neq("id", 0);
  if (error) {
    console.log(error);
  }
}

function getTextGivenMarkdownBase64(base64encodedText: string): string {
  const decodedText = atob(base64encodedText);
  // Remove html tags using cheerio
  const $ = load(decodedText);
  const cleanText = $.text();
  return cleanText;
}

async function getTextGivenPDFBase64(
  base64encodedText: string
): Promise<string> {
  const binaryData = atob(base64encodedText);
  let uint8Array = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    uint8Array[i] = binaryData.charCodeAt(i);
  }

  async function extractText(pdfData): Promise<string> {
    let textContent = "";
    const pdf = await getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textPage = await page.getTextContent();
      const textItems = textPage.items as TextItem[];
      textContent += textItems.map((item) => item.str).join(" ");
    }
    return textContent;
  }

  const text = await extractText(uint8Array);
  return text;
}

async function getFilesFromDirectory(
  dirContents: GithubGetContentsResponse[],
  basePath: string
): Promise<GithubGetContentsResponse[]> {
  const githubFileObjects = [] as GithubGetContentsResponse[];
  if (directoryStructure == "nested") {
    for (const subdir of dirContents) {
      if (!("name" in subdir)) {
        continue;
      }
      // Get all markdown files in each subdirectory
      const filesInSubdirectory = (await getGithubContents(
        `${basePath}${pathToContents}/${subdir.name}`
      )) as GithubGetContentsResponse[];
      githubFileObjects.push(...filesInSubdirectory);
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
  const filesOrDirs = (await getGithubContents(
    `${basePath}${pathToContents}`
  )) as GithubGetContentsResponse[]; // Gets a list of directories, each containing a list of markdown files
  const githubFileObjects = await getFilesFromDirectory(filesOrDirs, basePath);

  console.log("Adding file embeddings to supabase vector store...");
  const docs = [];
  for (const file of githubFileObjects) {
    if (!("path" in file)) {
      continue;
    }
    const base64encodedText = await getGithubContents(
      `${basePath}${file.path}`
    );
    if (!("content" in base64encodedText)) {
      continue;
    }
    let cleanText;
    if (extname(file.name) == ".md") {
      cleanText = getTextGivenMarkdownBase64(base64encodedText.content);
    } else if (extname(file.name) == ".pdf") {
      cleanText = await getTextGivenPDFBase64(base64encodedText.content);
    }
    const docsForCurrentDir = await textSplitter.createDocuments([cleanText]);
    docs.push(...docsForCurrentDir);
  }
  vectorStore.addDocuments(docs);
  console.log(`Added ${docs.length} file embeddings to supabase vector store`);
}

main();
