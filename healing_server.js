// server.js (NO CHANGES EXCEPT FOR CONTEXT; everything already works)

import express from "express";

import bodyParser from "body-parser";

import { OpenAI } from "openai";

import dotenv from "dotenv";

import cors from "cors";

import path from "path";

import fs from "fs";

import { fileURLToPath } from "url";


// ESM-friendly __dirname

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


dotenv.config();


const app = express();

const PORT = process.env.PORT || 5000;


// Create the openai client. Ensure OPENAI_API_KEY is set

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// The assistant ID you want to use. Must have the instructions configured in the dashboard.

const ASSISTANT_ID = "asst_iabnUfIym9Dymn4i3hv3iA11";


// In-memory store of user threads

const userThreads = {};

// Concurrency lock

const activeRequests = {};


function sleep(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}


app.use(cors());

app.use(express.json());

app.use(bodyParser.json());


// Serve static files from "public" if it exists

const staticPath = path.join(__dirname, "public");

if (fs.existsSync(staticPath)) {

  app.use(express.static(staticPath));

}


// Helper: get or create a thread for a user

async function getOrCreateThreadId(user_id) {

  if (userThreads[user_id]?.thread_id) {

    return userThreads[user_id].thread_id;

  }

  const thread = await client.beta.threads.create();

  const thread_id = thread.id;

  userThreads[user_id] = { thread_id, last_message: "" };