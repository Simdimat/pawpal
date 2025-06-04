/* server.js (UPDATED for email as user_id, feedback trigger on 2nd message, every 3rd problem, session logic, and further refined Desmos prompt with absolute value, function redefinition prevention, plaintext fix, and variable definitions in code block) */
import express from "express";
import bodyParser from "body-parser";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";

// Enhanced Debugger with File Logging in /tmp
const debug = {
  log: (...args) => {
    const message = `[DEBUG] ${new Date().toISOString()} ${args.join(" ")}\n`;
    console.log(message);
    try {
      fs.appendFileSync(path.join("/tmp", "debug.log"), message);
    } catch (err) {
      console.error(`[DEBUG-ERROR] Failed to write to /tmp/debug.log: ${err.message}`);
    }
  },
  warn: (...args) => {
    const message = `[DEBUG-WARN] ${new Date().toISOString()} ${args.join(" ")}\n`;
    console.warn(message);
    try {
      fs.appendFileSync(path.join("/tmp", "debug.log"), message);
    } catch (err) {
      console.error(`[DEBUG-ERROR] Failed to write to /tmp/debug.log: ${err.message}`);
    }
  },
  error: (...args) => {
    const message = `[DEBUG-ERROR] ${new Date().toISOString()} ${args.join(" ")}\n`;
    console.error(message);
    try {
      fs.appendFileSync(path.join("/tmp", "debug.log"), message);
    } catch (err) {
      console.error(`[DEBUG-ERROR] Failed to write to /tmp/debug.log: ${err.message}`);
    }
  },
  traceRequest: (req) => {
    // Log user_id from body or query, prioritizing email format if present
    const userIdFromBody = req.body?.user_id;
    const userIdFromQuery = req.query?.user_id;
    const effectiveUserId = (userIdFromBody || userIdFromQuery || 'unknown').includes('@') ? (userIdFromBody || userIdFromQuery) : 'browser_id'; // Mask non-email IDs

    const message = `[DEBUG-REQUEST] ${new Date().toISOString()} Method: ${req.method}, URL: ${req.url}, UserID: ${effectiveUserId}, Body: ${JSON.stringify(req.body)}, Query: ${JSON.stringify(req.query)}\n`;
    console.log(message);
    try {
      fs.appendFileSync(path.join("/tmp", "debug.log"), message);
    } catch (err) {
      console.error(`[DEBUG-ERROR] Failed to write to /tmp/debug.log: ${err.message}`);
    }
  },
  traceResponse: (res, data) => {
    const message = `[DEBUG-RESPONSE] ${new Date().toISOString()} Status: ${res.statusCode}, Data: ${JSON.stringify(data)}\n`;
    console.log(message);
    try {
      fs.appendFileSync(path.join("/tmp", "debug.log"), message);
    } catch (err) {
      console.error(`[DEBUG-ERROR] Failed to write to /tmp/debug.log: ${err.message}`);
    }
  }
};


// Enhanced Debugger with Module Loading and MongoDB Connection Details
try {
  debug.log("Attempting to import mongodb module...");
  const mongodb = await import("mongodb");
  debug.log("Successfully imported mongodb module:", mongodb.version);
} catch (err) {
  debug.error("Failed to import mongodb module:", err.message, err.stack);
}

// Ensure /tmp/debug.log file exists
try {
  if (!fs.existsSync(path.join("/tmp", "debug.log"))) {
    fs.writeFileSync(path.join("/tmp", "debug.log"), "");
  }
} catch (err) {
  console.error(`[DEBUG-ERROR] Failed to create /tmp/debug.log: ${err.message}`);
}

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const client = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const MODEL = "grok-2-1212";

// Mongo Setup with Detailed Debugging
let db = null;
let mongoClient = null;

async function connectToMongo(retryCount = 5) {
  if (db) {
    debug.log("MongoDB already connected.");
    return;
  }
  try {
    debug.log("MongoDB URI:", process.env.MONGODB_URI ? "Set (hidden for security)" : "Not set");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set.");
    }
    debug.log("Attempting to connect to MongoDB...");
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    debug.log("Created MongoClient instance.");
    await mongoClient.connect();
    debug.log("MongoClient connected successfully.");
    db = mongoClient.db();
    debug.log("MongoDB database instance obtained:", db.databaseName);
    debug.log("MongoDB connected successfully!");
  } catch (err) {
    debug.error("Failed to connect to MongoDB:", err.message, err.stack);
    if (retryCount > 0) {
      debug.log(`Retrying connection. Retries left: ${retryCount}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return connectToMongo(retryCount - 1);
    }
    debug.error("MongoDB connection failed after all retries. Continuing without DB.");
    db = null; // Set db to null to allow fallback behavior
  }
}
connectToMongo().catch((err) => debug.error("Initial MongoDB connection error:", err.message, err.stack));

// Collections with fallback
const collections = {
  // Ensure user_id field is indexed in MongoDB for performance
  conversations: () => db?.collection("conversations") || { findOne: () => Promise.resolve(null), updateOne: () => Promise.resolve(), aggregate: () => ({ toArray: () => Promise.resolve([]) }), insertOne: () => Promise.resolve() }, // Added insertOne for getUserDocument
  extraDifficult: () => db?.collection("extra_difficult_problems") || { findOne: () => Promise.resolve(null), find: () => ({ toArray: () => Promise.resolve([]) }) },
  hardProblems: () => db?.collection("hard_problems") || { findOne: () => Promise.resolve(null), find: () => ({ toArray: () => Promise.resolve([]) }) },
  regularProblems: () => db?.collection("regular_problems") || { findOne: () => Promise.resolve(null), find: () => ({ toArray: () => Promise.resolve([]) }) },
  users: () => db?.collection("users") || { findOne: () => Promise.resolve(null), updateOne: () => Promise.resolve() }, // Keep users collection for email-related info if needed, though conversations might suffice
  feedback: () => db?.collection("feedback") || { insertOne: () => Promise.resolve() }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const staticPath = path.join(__dirname, "public");
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

app.use(async (req, res, next) => {
  debug.traceRequest(req); // Trace request happens here now
  if (!db) {
    debug.warn("DB not ready. Retrying connectToMongo...");
    await connectToMongo();
  }
  const originalJson = res.json;
  res.json = function (data) {
    debug.traceResponse(res, data);
    return originalJson.call(this, data);
  };
  next();
});

// DB Helpers (Unchanged from previous update)

// Helper to get user document, ensuring default structure
async function getUserDocument(user_id) {
    if (!db || typeof collections.conversations !== 'function') {
        debug.error("DB not available or conversations collection getter is invalid in getUserDocument.");
        return null;
    }
    const conversationsCollection = collections.conversations();
    if (!conversationsCollection || typeof conversationsCollection.findOne !== 'function') {
        debug.error("Conversations collection object is invalid or findOne method is missing.");
        return null;
    }

    let doc;
    try {
        doc = await conversationsCollection.findOne({ user_id });
    } catch (findErr) {
        debug.error(`Error finding user document for ${user_id}:`, findErr.message);
        return null;
    }

    if (!doc) {
        // If user doesn't exist, create a basic structure
        doc = {
            user_id,
            conversation: [],
            used_problems: {},
            problems_interacted: {}, // Track problems where feedback count was triggered (2+ messages)
            interacted_problem_count: 0, // Count of unique problems with 2+ messages
            last_problems: {},
            last_problem_ids: {},
            last_problem_categories: {},
            feedbackNeeded: false
        };
        try {
            if (typeof conversationsCollection.insertOne !== 'function') {
                 debug.error("Conversations collection insertOne method is missing.");
                 return null; // Cannot insert
            }
            await conversationsCollection.insertOne(doc);
            debug.log(`Created new document structure for user_id: ${user_id}`);
        } catch (insertErr) {
            debug.error(`Error inserting new user document for ${user_id}:`, insertErr.message);
            return null; // Return null if insertion fails
        }
    }
    // Ensure nested objects exist (important!)
    doc.used_problems = doc.used_problems || {};
    doc.problems_interacted = doc.problems_interacted || {};
    doc.last_problems = doc.last_problems || {};
    doc.last_problem_ids = doc.last_problem_ids || {};
    doc.last_problem_categories = doc.last_problem_categories || {};
    return doc;
}


async function getConversation(user_id, problem_id) {
  // Use the user_id (which should be email if logged in)
  if (!db) {
    debug.log("No DB connection, returning empty conversation.");
    return [];
  }
  debug.log(`Fetching conversation for user_id=${user_id}, problem_id=${problem_id}`);
  try {
    // Find the document based on user_id (email or browser ID)
    const doc = await collections.conversations().findOne({ user_id });
    if (!doc || !doc.conversation) return [];
    // Filter messages specifically for the requested problem_id
    return doc.conversation.filter(msg => String(msg.problem_id) === String(problem_id)) || [];
  } catch (err) {
    debug.error(`Error in getConversation for ${user_id}:`, err.message, err.stack);
    return [];
  }
}

async function pushMessageToConversation(user_id, role, content, problem_id) {
  if (db) {
    debug.log(`Pushing message for user_id=${user_id}, role=${role}, problem_id=${problem_id}`);
    try {
       const conversationsCollection = collections.conversations();
        if (!conversationsCollection || typeof conversationsCollection.updateOne !== 'function') {
            debug.error("Conversations collection is invalid or updateOne is missing in pushMessageToConversation.");
            return; // Cannot update
        }
      // Use user_id (email or browser ID) as the key
      const result = await conversationsCollection.updateOne(
        { user_id },
        {
          $push: {
            conversation: { role, content, timestamp: new Date().toISOString(), problem_id },
          },
          $setOnInsert: { // Set default fields only if inserting a new user document
            user_id,
            used_problems: {},
            problems_interacted: {},
            interacted_problem_count: 0,
            last_problems: {},
            last_problem_ids: {},
            last_problem_categories: {},
            feedbackNeeded: false
          },
        },
        { upsert: true } // Create the document if it doesn't exist
      );
       if (result.upsertedCount > 0) {
         debug.log(`Upserted new conversation document for user_id: ${user_id}`);
       } else if (result.matchedCount > 0) {
         debug.log(`Updated conversation for user_id: ${user_id}`);
       } else {
         debug.warn(`pushMessageToConversation did not match or upsert for user_id: ${user_id}`);
       }
    } catch (err) {
      debug.error(`Error in pushMessageToConversation for ${user_id}:`, err.message, err.stack);
    }
  } else {
    debug.log("DB not available, skipping conversation update.");
  }
}

async function setLastProblem(user_id, problem_id, problemText) {
  if (db) {
    debug.log(`Setting last problem for user_id=${user_id}, problem_id=${problem_id}`);
    try {
      const conversationsCollection = collections.conversations();
       if (!conversationsCollection || typeof conversationsCollection.updateOne !== 'function') {
            debug.error("Conversations collection is invalid or updateOne is missing in setLastProblem.");
            return; // Cannot update
        }
      // Update based on user_id (email or browser ID)
      await conversationsCollection.updateOne(
        { user_id },
        { $set: { [`last_problems.${problem_id}`]: problemText } },
        { upsert: true } // Ensure doc exists
      );
    } catch (err) {
      debug.error(`Error in setLastProblem for ${user_id}:`, err.message, err.stack);
    }
  } else {
    debug.log("DB not available, skipping last problem update.");
  }
}

async function getLastProblem(user_id, problem_id) {
  if (!db) {
    debug.log("No DB connection, returning empty last problem.");
    return "";
  }
  debug.log(`Fetching last problem for user_id=${user_id}, problem_id=${problem_id}`);
  try {
    // Find based on user_id (email or browser ID)
    const doc = await collections.conversations().findOne({ user_id });
    return doc?.last_problems?.[problem_id] || "";
  } catch (err) {
    debug.error(`Error in getLastProblem for ${user_id}:`, err.message, err.stack);
    return "";
  }
}

async function markProblemUsed(user_id, category, problemId) {
  // This function might be less critical if we load all problems initially,
  // but keep it for potential future use or explicit tracking.
  if (db) {
    debug.log(`Marking problem as used: user_id=${user_id}, category=${category}, problemId=${problemId}`);
    try {
       const conversationsCollection = collections.conversations();
       if (!conversationsCollection || typeof conversationsCollection.updateOne !== 'function') {
            debug.error("Conversations collection is invalid or updateOne is missing in markProblemUsed.");
            return; // Cannot update
        }
      // Update based on user_id (email or browser ID)
      await conversationsCollection.updateOne(
        { user_id },
        { $set: { [`used_problems.${category}.${problemId}`]: true } },
        { upsert: true } // Ensure doc exists
      );
    } catch (err) {
      debug.error(`Error in markProblemUsed for ${user_id}:`, err.message, err.stack);
    }
  } else {
    debug.log("DB not available, skipping problem usage mark.");
  }
}

async function getNextProblem(user_id, category, topic = null) {
  if (!db) {
    debug.log("No DB connection, returning null problem.");
    return null;
  }
  debug.log(`Fetching next available problem for user_id=${user_id}, category=${category}, topic=${topic}`);
  try {
    // Find based on user_id (email or browser ID)
    const userDoc = await getUserDocument(user_id); // Use helper to ensure structure
    if (!userDoc) return null;

    const used = userDoc.used_problems?.[category] || {};
    const query = topic ? { topic } : {};
    debug.log(`Querying ${category} collection with query: ${JSON.stringify(query)} excluding IDs: ${JSON.stringify(Object.keys(used))}`);

    const problemCollection = collections[category]();
    if (!problemCollection || typeof problemCollection.findOne !== 'function') {
        debug.error(`Invalid collection or method for category: ${category}`);
        return null;
    }

    const problem = await problemCollection.findOne({
      ...query,
      _id: { $nin: Object.keys(used).map(id => {
          try { return new ObjectId(id); } catch { return null; } // Handle potential invalid IDs
      }).filter(id => id !== null) }, // Filter out nulls from invalid IDs
    });

    if (problem) {
       debug.log(`Found next problem: ${problem._id}`);
       // Mark as used immediately
       await markProblemUsed(user_id, category, problem._id.toString());
    } else {
       debug.log(`No unused problems found for category ${category}, topic ${topic}`);
    }
    return problem;
  } catch (err) {
    debug.error(`Error in getNextProblem for ${user_id}:`, err.message, err.stack);
    return null;
  }
}

// Endpoint: /api/email (Save email and return user state) - Unchanged
app.post("/api/email", async (req, res) => {
  const { email, user_id: browser_user_id } = req.body; // user_id here is the browser-generated one
  if (!email) {
    return res.status(400).json({ error: "Missing 'email'." });
  }
  // Use the email as the primary user_id for DB operations
  const primary_user_id = email;
  debug.log(`/api/email called for email: ${primary_user_id}, browser_id: ${browser_user_id}`);

  if (!db) {
    debug.log("DB not available, skipping email store, but returning success for fallback.");
    return res.json({ success: true, note: "DB not connected. Email not stored in DB.", chattedProblemIds: [] });
  }
  try {
    // Ensure a document exists in 'conversations' for this email
    const userDoc = await getUserDocument(primary_user_id); // Use helper
    if (!userDoc) {
        // If getUserDocument failed (e.g., DB error after retries), return error
        return res.status(500).json({ error: "Failed to retrieve or create user session." });
    }

    // Get the list of problem IDs the user has interacted with (sent at least one message)
    const interactedProblems = userDoc.problems_interacted || {};
    const chattedProblemIds = Object.keys(interactedProblems);

    debug.log(`Returning session for ${primary_user_id}. Chatted problems (counted): ${chattedProblemIds.length}`);
    return res.json({ success: true, chattedProblemIds }); // Return IDs of problems counted towards feedback

  } catch (err) {
    debug.error(`Error in /api/email for ${primary_user_id}:`, err.message, err.stack);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Endpoint: /api/feedback - Unchanged
app.post("/api/feedback", async (req, res) => {
  const { user_id, feedback } = req.body; // user_id is email or browser ID
  if (!user_id || !feedback) {
    return res.status(400).json({ error: "Missing user_id or feedback." });
  }
  debug.log(`/api/feedback called for user_id: ${user_id}`);
  if (!db) {
    debug.log("DB not available, skipping feedback store, but returning success for fallback.");
    return res.json({ success: true, note: "DB not connected, feedback not stored." });
  }
  try {
    const feedbackCollection = collections.feedback();
     if (!feedbackCollection || typeof feedbackCollection.insertOne !== 'function') {
        debug.error("Feedback collection is invalid or insertOne is missing.");
        return res.status(500).json({ error: "Internal server error (DB config)." });
     }
    await feedbackCollection.insertOne({ user_id, feedback, timestamp: new Date().toISOString() });
    // Reset feedbackNeeded flag for this user
    const conversationsCollection = collections.conversations();
     if (conversationsCollection && typeof conversationsCollection.updateOne === 'function') {
        await conversationsCollection.updateOne({ user_id }, { $set: { feedbackNeeded: false } });
        debug.log(`Feedback saved and flag reset for user_id: ${user_id}`);
     } else {
         debug.error("Conversations collection invalid or updateOne missing, cannot reset feedback flag.");
     }
    return res.json({ success: true });
  } catch (err) {
    debug.error(`Error in /api/feedback for ${user_id}:`, err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/problems - Unchanged
app.get("/api/problems", async (req, res) => {
  try {
    const { category, topic, user_id } = req.query; // user_id is email or browser ID
    if (!category || !user_id) return res.status(400).json({ error: "Missing 'category' or 'user_id'." });
    debug.log(`Fetching problems for category=${category}, topic=${topic}, user_id=${user_id}`);

    if (!db) {
        debug.warn("DB not available for /api/problems. Returning empty list.");
        return res.json([]);
    }

    const problemCollection = collections[category]();
    if (!problemCollection || typeof problemCollection.find !== 'function') {
        debug.error(`Invalid collection requested: ${category}`);
        return res.status(400).json({ error: "Invalid category specified." });
    }

    // Fetch ALL problems for the category/topic - client will filter/display
    const query = topic ? { topic } : {};
    const problems = await problemCollection.find(query).toArray();

    // Get user's problems that have been counted towards feedback (2+ messages)
    const userDoc = await getUserDocument(user_id);
    const interactedProblems = userDoc?.problems_interacted || {};
    const chattedProblemIds = Object.keys(interactedProblems); // These are the IDs counted for feedback


    // Add chattedBefore status based on interactions counted for feedback
    const problemsWithStatus = problems.map(p => ({
        ...p,
        chattedBefore: chattedProblemIds.includes(p._id.toString())
    }));

    debug.log(`Returning ${problemsWithStatus.length} problems for category ${category}, topic ${topic} for user ${user_id}`);
    res.json(problemsWithStatus); // Send all problems with their status based on feedback count trigger

  } catch (error) {
    debug.error(`Error in /api/problems for user ${req.query.user_id}:`, error.message, error.stack);
    res.status(500).json({ error: "Internal server error." });
  }
});


// GET /api/history - Unchanged
app.get("/api/history", async (req, res) => {
  try {
    const user_id = req.query.user_id; // user_id is email or browser ID
    const problem_id = req.query.problem_id;
    if (!user_id) return res.status(400).json({ error: "Missing user_id" });
    if (!problem_id) return res.status(400).json({ error: "Missing problem_id" }); // Require problem_id

    debug.log(`Fetching history for user_id=${user_id}, problem_id=${problem_id}`);
    const conversation = await getConversation(user_id, problem_id); // Fetches only relevant history
    res.json({ conversation });
  } catch (error) {
    debug.error(`Error in /api/history for user ${req.query.user_id}:`, error.message, error.stack);
    res.status(500).json({ error: "Internal server error." });
  }
});


// POST /api/assistant
app.post("/api/assistant", async (req, res) => {
  // user_id is email or browser ID
  const { message, user_id, problem_id, selectedProblemId } = req.body;
  if (!message || !user_id || !problem_id) {
    return res.status(400).json({ error: "Missing 'message', 'user_id', or 'problem_id'." });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    debug.log(`[User ${user_id}] typed: ${message} for problem_id: ${problem_id}, selectedProblemId: ${selectedProblemId}`);

    // --- Initial Feedback Check (BEFORE Generation/Selection) ---
    const numericCmd = parseInt(message, 10);
    const isProblemGenerationOrSelection = selectedProblemId || (!isNaN(numericCmd) && numericCmd >= 1 && numericCmd <= 6);
    let feedbackNeeded = false;

    // Check if feedback is *already pending* before generating/selecting a new problem
    if (db && isProblemGenerationOrSelection) {
       const userDoc = await getUserDocument(user_id);
       feedbackNeeded = userDoc?.feedbackNeeded || false;
        if (feedbackNeeded) {
            debug.log(`Feedback required for user ${user_id} before generating/selecting problem.`);
            // Send empty event to trigger client-side feedback modal
            res.write(`data: ${JSON.stringify("")}\n\n`);
            res.end();
            debug.log(`[Assistant Response for User ${user_id}]: Feedback required, triggering client modal.`);
            return; // Stop processing until feedback is submitted
        }
    }
    // --- End Initial Check ---


    // --- Process Message ---
    // Push user message FIRST
    await pushMessageToConversation(user_id, "user", message, problem_id);

    // --- NEW: Check interaction count and trigger feedback AFTER pushing the 2nd user message ---
    if (db) {
        const currentConversationForProblem = await getConversation(user_id, problem_id);
        const userMessagesForProblemCount = currentConversationForProblem.filter(m => m.role === 'user').length;
        debug.log(`User ${user_id} now has ${userMessagesForProblemCount} messages for problem ${problem_id}.`);

        // Check if this is EXACTLY the second user message for this problem
        if (userMessagesForProblemCount === 2) {
            debug.log(`Second user message detected for problem ${problem_id}. Checking interaction count.`);
            const userDoc = await getUserDocument(user_id); // Get current user state

            // Ensure we haven't already counted this problem interaction (check problems_interacted)
            if (userDoc && (!userDoc.problems_interacted || !userDoc.problems_interacted[problem_id])) {
                 let currentCount = userDoc.interacted_problem_count || 0;
                 currentCount++; // Increment the count of problems meeting the criteria
                 const problemKey = `problems_interacted.${problem_id}`;

                 // Check if feedback is needed based on the NEW count (every 3rd problem)
                 let newFeedbackNeeded = (currentCount > 0 && currentCount % 3 === 0); // Use modulo 3
                 debug.log(`Interaction count for ${user_id} incremented to ${currentCount}. Feedback triggered: ${newFeedbackNeeded}`);

                 // Update the document: increment count, mark problem interacted, set feedback status if triggered
                 try {
                    const conversationsCollection = collections.conversations();
                    if (conversationsCollection && typeof conversationsCollection.updateOne === 'function') {
                         await conversationsCollection.updateOne(
                             { user_id },
                             {
                                 $set: {
                                     [problemKey]: true, // Mark this problem as counted towards feedback
                                     interacted_problem_count: currentCount,
                                     // Conditionally set feedbackNeeded to true, never set it to false here
                                     ...(newFeedbackNeeded && { feedbackNeeded: true })
                                 }
                             }
                         );
                         // Update local feedbackNeeded variable for this request if it was just triggered
                         if (newFeedbackNeeded) {
                             feedbackNeeded = true; // Update local state
                         }
                         debug.log(`Updated interaction count and feedback status for ${user_id}.`);
                    } else {
                        debug.error("Cannot update interaction count: conversations collection or updateOne is invalid.");
                    }
                 } catch (updateErr) {
                     debug.error(`Error updating interaction count for ${user_id}:`, updateErr.message);
                 }
            } else {
                 if (!userDoc) {
                     debug.warn(`User document not found for ${user_id} during 2nd message check.`);
                 } else {
                    debug.log(`Problem ${problem_id} already counted towards feedback for ${user_id}.`);
                 }
            }
        }
    }
    // --- END OF NEW FEEDBACK CHECK ---


    // --- Continue with original logic to determine response ---
    const conversationHistory = await getConversation(user_id, problem_id); // Get history *for this specific problem*

    // --- Updated System Prompt for Desmos Formatting (Reinforced YET AGAIN) ---
    const systemPrompt = `
### Strict Input-Action Mapping
You must strictly map the input number to its assigned action without deviation. Do not interpret, modify, or guess intent. Execute only the exact action below:

- "1" → Generate an Extra-Difficult Problem from extra_difficult_problems (from Extra_Difficult_ProblemsABC only). Add: "This problem may be easier to solve by hand than using Desmos."
- "2" → Generate a Hard Problem from hard_problems (from Sat_Hard_ProblemsXYZ only). Generate 3 unique hints at the start. Add: "This problem may be easier to solve by hand than using Desmos."
- "3" → Generate a Regular Algebra Problem from regular_problems (from SATProbs1, SATProbs2, SATProbs3 only).
- "4" → Generate a Regular Advanced Math Problem from regular_problems (from SATProbs1, SATProbs2, SATProbs3 only).
- "5" → Generate a Regular Problem-Solving and Data Analysis Problem from regular_problems (from SATProbs1, SATProbs2, SATProbs3 only).
- "6" → Generate a Regular Geometry and Trigonometry Problem from regular_problems (from SATProbs1, SATProbs2, SATProbs3 only).
- "7" → Provide Fast Time-Saving Hacks for the last problem provided in the conversation history.
- "8" → Provide a Simple Step-by-Step Explanation for the last problem provided in the conversation history.
- "9" → Provide a Desmos Explanation for the last problem provided in the conversation history:
  Always start with the Desmos calculator link as plain text: https://www.desmos.com/testing/cb-digital-sat/graphing (do not use markdown link syntax like [link](url)).
  Follow these rules ABSOLUTELY for the **entire response**, especially the **"Copyable Code for Desmos"** section:
  1. Step-by-Step Desmos Approach:
     - Provide a detailed explanation of how to solve the problem step by step using Desmos.
     - Break the solution process into clear, sequential steps using a newline followed by a dash (-), like this: \\n- Step 1\\n- Step 2, etc.
     - Reference variables from the Single Letter Definitions section.
     - Explain how to interpret the graph or calculation in Desmos.
  2. Order of Sections:
     - Generate sections in this exact order:
       1. Step-by-Step Desmos Approach (use ### Step-by-Step Desmos Approach:)
       2. Single Letter Definitions: (use ### Single Letter Definitions:)
       3. Copyable Code for Desmos: (use ### Copyable Code for Desmos: followed by \\n\\n\\\`\\\`\\\`plaintext\\n<your code here>\\n\\\`\\\`\\\`)
       4. Answer: (use ### Answer:)
  3. Single Letter Variables Only:
     - Use only single-letter variables (e.g., a, b, x, y, y_1). No multi-letter variables (e.g., sin_F, radius).
     - Use E_1, E_2, E_t for subscripts, not E1 or E_total.
     - Define all variables used in the "Copyable Code" in the "Single Letter Definitions" section using variable = Description.
     - **Variable Assignment in Code:** Define variables on separate lines *within the Copyable Code block*. WRONG: (x_{1},y_{1})=(2,4). RIGHT (inside code block): x_1 = 2\\ny_1 = 4. Include ALL necessary variable assignments from "Single Letter Definitions" inside the code block.
     - **Function Redefinition:** AVOID defining the same function name (e.g., f(x)) multiple times within the Copyable Code block. If evaluating a function with specific values, assign the result to a new, unused variable (e.g., y_eval = f(1)). If showing different potential functions from multiple choice, use distinct names (e.g., f_A(x), f_B(x)).
  4. Formatting Rules for "Copyable Code for Desmos" (MOST CRITICAL):
     - **Multiplication:** MUST use \\cdot instead of *. Example: a*b MUST become a\\cdot b. 2*a MUST become 2\\cdot a. NO EXCEPTIONS.
     - **Exponents:** MUST use curly braces {} for the entire exponent. Example: a^2 MUST become a^{2}. 2^t MUST become 2^{t}. 10^(4x-3) MUST become 10^{4x-3}. x^-1 MUST become x^{-1}. NO EXCEPTIONS.
     - **Fractions:** MUST use \\frac{numerator}{denominator}. Parenthesize numerator and denominator if they contain operations or multiple terms. Example: (x^2 - c)/(x - b) MUST become \\frac{(x^2 - c)}{(x - b)}. (x+3)/(x-2) MUST become \\frac{(x+3)}{(x-2)}. x/2 MUST become \\frac{x}{2}. NO EXCEPTIONS.
     - **Fractions WITHIN exponents:** MUST use \\left(\\frac{}{}\\right) format wrapped in the exponent's curly braces. Example: 2^(t/b) MUST become 2^{\\left(\\frac{t}{b}\\right)}. 3^(x/2) MUST become 3^{\\left(\\frac{x}{2}\\right)}. NO EXCEPTIONS.
     - **Roots:** Use \\sqrt{argument} for square roots. Example: sqrt(y+4) MUST become \\sqrt{y+4}. h/sqrt(3) MUST become \\frac{h}{\\sqrt{3}}. Use \\sqrt[n]{argument} for nth roots. Example: cbrt(x-2) MUST become \\sqrt[3]{x-2}. NO EXCEPTIONS.
     - **Absolute Value:** Use \\operatorname{abs}(argument). Example: |x| MUST become \\operatorname{abs}(x). NO EXCEPTIONS.
     - **Trigonometry:** Use standard function names with parentheses for arguments: \\sin(arg), \\cos(arg), \\tan(arg). For inverse trig, use \\arcsin(arg), \\arccos(arg), \\arctan(arg). Example: sin(pi/4 * x) MUST become \\sin(\\frac{\\pi}{4} x). tan^-1(x/2) MUST become \\arctan(\\frac{x}{2}). NOTE: Powers on trig functions like sin^2(x) must be written for Desmos as (\\sin(x))^{2}.
     - **Logarithms:** Use \\ln(arg) for natural log. Use \\log_{base}(arg) for other bases (base must be a number). Example: log_2(x+4). log10(x/y) MUST become \\log_{10}(\\frac{x}{y}).
     - **Inequalities:** Use standard symbols: >, <, \\geq, \\leq. Example: y > 2x + 1. x^2 + y^2 < 25.
     - **Numbers:** No commas (e.g., 60000). Use standard decimal points.
     - **Code Block:** Must be enclosed in \`\`\`plaintext ... \`\`\`. The word "plaintext" MUST NOT appear *inside* the code content itself, only in the opening fence. No comments inside the block.
     - **Variables:** Must match "Single Letter Definitions". All variables used in equations within the code block MUST be assigned a value within the same code block (e.g., include lines like a=4, b=4,...). Use only x and y for implicit equations (e.g., 80x + 60y = 1440, (x - 3)^2 + (y + 1)^2 = 16).
  5. Validation for "Copyable Code for Desmos":
     - Before appending "Copyable Code Verified", meticulously check if EVERY SINGLE LINE in the generated code block strictly adheres to ALL rules in subsection 3 and 4, ESPECIALLY:
       - Are ALL necessary variable assignments included inside the code block?
       - Is ALL multiplication using \\cdot?
       - Does EVERY exponent use {...}?
       - Does EVERY fraction within an exponent use {...\\left(\\frac{}{}\\right)...}?
       - Is standard fraction format \\frac{}{} used correctly (with parentheses if needed)?
       - Are roots formatted as \\sqrt{} or \\sqrt[]{}? Absolute value as \\operatorname{abs}()?
       - Are trig/log functions using correct names and argument parentheses? Inverse trig using arc...? Trig powers using (...)^...?
       - Are variables defined separately and correctly? No function redefinitions (using distinct names or evaluation variables)?
       - Are inequalities using correct symbols?
       - Is implicit equation using only x and y?
       - Is the word "plaintext" ABSENT from the code content?
     - If EVEN ONE rule is violated, DO NOT append "Copyable Code Verified". Instead, state "Error: Desmos code formatting is incorrect." and STOP. If all rules are perfectly met, append "Copyable Code Verified".
- "10" → Simply Explain the Core Concept for the last problem provided in the conversation history.

### General Rules
- For all responses involving mathematical expressions (e.g., fractions, equations, variables in text), wrap them in \\(...\\). Let the client handle LaTeX rendering with KaTeX. Do not use $...$ or $$...$$.
- For "1-6": Append: "On the real test, you need to solve this question in approximately [calculated time] seconds based on its difficulty level. Use a timer to see if you can solve this in time and type your answer below. Or Choose one of the following:\\n7. Fast Time-Saving Hacks\\n8. Simple Step-by-Step Explanation\\n9. Desmos Explanation\\n10. Simply Explain Core Concept"
- For "7, 8, 9, 10": Append: "Hope everything was clear! If not, choose the following:\\n7. Fast Time-Saving Hacks\\n8. Simple Step-by-Step Explanation\\n9. Desmos Explanation\\n10. Simply Explain Core Concept"
- Verify all arithmetic explicitly (e.g., 10 + 22 = 32). Never repeat problems in the same thread unless explicitly requested.
- For "1": Do not include explanations. For "2": Include 3 unique hints from the problem data.
- If no problems remain in a category, respond: "No more problems available in this category. Please try a different category (e.g., 1, 2, 3, 4, 5, or 6)."
- For any input that does not match the above commands (1-10 or A-D), interpret it as a general math question related to the current problem context (if any) and provide a detailed, accurate solution as a math expert. Use step-by-step explanations and LaTeX formatting \\(...\\) where applicable.
- If a problem_id is provided, use the conversation history associated ONLY with that specific problem_id as context.
`;
    // --- End Updated System Prompt ---

    let assistantResponse = "";
    const lastProblemText = await getLastProblem(user_id, problem_id); // Get text of problem for context if needed
    const problemCommands = ["1", "2", "3", "4", "5", "6"];
    const explanationCommands = ["7", "8", "9", "10"];
    const answerChoices = ["A", "B", "C", "D"];

    let messagesToGrok = [{ role: "system", content: systemPrompt }];

    // Add relevant conversation history for the *current problem_id*
    const currentHistory = await getConversation(user_id, problem_id); // Re-fetch to ensure it's up-to-date
    messagesToGrok = messagesToGrok.concat(
        currentHistory.map(msg => ({ role: msg.role, content: msg.content }))
        // The latest user message is already included here because we pushed it first
    );


    // Handle problem generation (selected or new) - Unchanged logic block
     if (selectedProblemId || problemCommands.includes(message)) {
          let category = null;
          let topic = null;
          let problemDoc = null;
          let commandMessage = message; // Use original command if not selectedProblemId

          if (selectedProblemId) {
              debug.log(`Handling selectedProblemId: ${selectedProblemId}`);
              const userDoc = await getUserDocument(user_id);
              category = userDoc?.last_problem_categories?.[problem_id]; // Get category associated with the *current chat thread*
               if (!category && db) { // Fallback: try finding the problem in all collections if category is missing
                    const collectionsToSearch = ['extraDifficult', 'hardProblems', 'regularProblems'];
                    for (const collName of collectionsToSearch) {
                        try {
                            const collGetter = collections[collName];
                            if (collGetter && typeof collGetter === 'function') {
                                const coll = collGetter();
                                if(coll && typeof coll.findOne === 'function') {
                                    problemDoc = await coll.findOne({ _id: new ObjectId(selectedProblemId) });
                                    if (problemDoc) {
                                        category = collName;
                                        debug.log(`Found selectedProblemId ${selectedProblemId} in collection ${category}`);
                                        break;
                                    }
                                }
                            }
                        } catch (findErr) { debug.error(`Error searching ${collName} for ${selectedProblemId}: ${findErr.message}`); }
                    }
               } else if (category && db) {
                 try {
                   const collGetter = collections[category];
                   if (collGetter && typeof collGetter === 'function') {
                       const coll = collGetter();
                       if (coll && typeof coll.findOne === 'function') {
                           problemDoc = await coll.findOne({ _id: new ObjectId(selectedProblemId) });
                       } else {
                           debug.error(`Collection object invalid or findOne missing for category ${category}`);
                       }
                   } else {
                        debug.error(`Invalid collection getter for category ${category}`);
                   }
                 } catch (findErr) { debug.error(`Error searching ${category} for ${selectedProblemId}: ${findErr.message}`);}
               }

              if (!problemDoc) {
                 assistantResponse = `Error: Could not find the selected problem with ID ${selectedProblemId}. Please select another problem or generate a new one.`;
                 debug.error(assistantResponse);
                 res.write(`data: ${JSON.stringify(assistantResponse)}\n\n`);
                 res.end();
                 await pushMessageToConversation(user_id, "assistant", assistantResponse, problem_id);
                 return;
               }
          } else {
              // Generate a new problem based on command 1-6
              if (message === "1") category = "extraDifficult";
              else if (message === "2") category = "hardProblems";
              else if (["3", "4", "5", "6"].includes(message)) category = "regularProblems";

              if (message === "3") topic = "Algebra";
              else if (message === "4") topic = "Advanced Math";
              else if (message === "5") topic = "Problem-Solving and Data Analysis";
              else if (message === "6") topic = "Geometry and Trigonometry";

              problemDoc = await getNextProblem(user_id, category, topic); // Fetches and marks used
          }


           if (!problemDoc) {
             // Handle case where no more problems are available
             assistantResponse = "No more problems available in this category. Please try a different category (e.g., 1, 2, 3, 4, 5, or 6).";
             res.write(`data: ${JSON.stringify(assistantResponse)}\n\n`);
             res.end();
             await pushMessageToConversation(user_id, "assistant", assistantResponse, problem_id);
             debug.log(`[Assistant Response for User ${user_id}]:\n${assistantResponse}`);
             return;
           }

            // Construct the response text
            assistantResponse = problemDoc.text;
            const currentProblemActualId = problemDoc._id.toString(); // The actual ID of the problem shown

            if (category === "extraDifficult") {
                assistantResponse += "\nThis problem may be easier to solve by hand than using Desmos.";
            }
            if (category === "hardProblems") {
                // Ensure hints are accessed safely
                const hints = problemDoc.hints && problemDoc.hints.length >= 3
                  ? problemDoc.hints
                  : ["Consider breaking it down.", "Look for patterns.", "Check your units."];
                assistantResponse += `\nHints: 1. ${hints[0]} 2. ${hints[1]} 3. ${hints[2]}\nThis problem may be easier to solve by hand than using Desmos.`;
            }

            const time = category === "extraDifficult" ? 120
                : category === "hardProblems" ? 90 : 60;
            // Append standard follow-up options for problems
            assistantResponse += `\nOn the real test, you need to solve this question in approximately ${time} seconds based on its difficulty level. Use a timer to see if you can solve this in time and type your answer below. Or Choose one of the following:\n7. Fast Time-Saving Hacks\n8. Simple Step-by-Step Explanation\n9. Desmos Explanation\n10. Simply Explain Core Concept`;


            // Save the generated problem text and its actual ID for the current chat thread (problem_id)
            await setLastProblem(user_id, problem_id, assistantResponse); // Save the *full* text including follow-up
             const conversationsCollection = collections.conversations();
             if (conversationsCollection && typeof conversationsCollection.updateOne === 'function') {
                await conversationsCollection.updateOne(
                    { user_id },
                    { $set: {
                        [`last_problem_ids.${problem_id}`]: currentProblemActualId,
                        [`last_problem_categories.${problem_id}`]: category
                    } },
                    { upsert: true }
                );
             } else {
                 debug.error("Cannot save last problem ID/category: conversations collection or updateOne is invalid.");
             }


            res.write(`data: ${JSON.stringify(assistantResponse)}\n\n`);
            res.end();
            await pushMessageToConversation(user_id, "assistant", assistantResponse, problem_id);
            debug.log(`[Assistant Response for User ${user_id} Problem ${problem_id}]:\n${assistantResponse}`);

     }
    // Handle answer choices A-D - Unchanged logic block
    else if (answerChoices.includes(message.toUpperCase())) {
        // Retrieve the actual ID and category of the last problem shown in this thread
        const userDoc = await getUserDocument(user_id);
        const lastProblemActualId = userDoc?.last_problem_ids?.[problem_id];
        const lastProblemCategory = userDoc?.last_problem_categories?.[problem_id];

        let problemDoc = null;
        if (lastProblemActualId && lastProblemCategory && db) {
            try {
                const collGetter = collections[lastProblemCategory];
                 if (collGetter && typeof collGetter === 'function') {
                     const coll = collGetter();
                     if (coll && typeof coll.findOne === 'function') {
                         problemDoc = await coll.findOne({ _id: new ObjectId(lastProblemActualId) });
                     } else {
                          debug.error(`Collection object invalid or findOne missing for category ${lastProblemCategory}`);
                     }
                 } else {
                     debug.error(`Invalid collection getter for category ${lastProblemCategory}`);
                 }
            } catch (findErr) {
                debug.error(`Error finding problem ${lastProblemActualId} in ${lastProblemCategory}: ${findErr.message}`);
            }
        }

        if (problemDoc && problemDoc.correctAnswer) {
            const correctAnswer = problemDoc.correctAnswer.toUpperCase(); // Ensure comparison is case-insensitive
            if (message.toUpperCase() === correctAnswer) {
               assistantResponse = "That is correct! Please choose one of the following:";
            } else {
               assistantResponse = `Incorrect. The correct answer is ${correctAnswer}. Please choose one of the explanations below:`;
            }
            // Append standard follow-up options for answers
            assistantResponse += "\nHope everything was clear! If not, choose the following:\n7. Fast Time-Saving Hacks\n8. Simple Step-by-Step Explanation\n9. Desmos Explanation\n10. Simply Explain Core Concept";
        } else {
            assistantResponse = "Could not retrieve the last problem to check the answer. Please generate a problem first (1-6).";
            debug.warn(`Could not find problem doc or correct answer for user ${user_id}, thread ${problem_id}, actual ID ${lastProblemActualId}`);
        }

        res.write(`data: ${JSON.stringify(assistantResponse)}\n\n`);
        res.end();
        await pushMessageToConversation(user_id, "assistant", assistantResponse, problem_id);
        debug.log(`[Assistant Response for User ${user_id} Problem ${problem_id}]:\n${assistantResponse}`);
    }
     // Handle explanation commands (7-10) and general chat
    else {
         // Add the last problem shown as context for explanations or follow-up questions
         if (lastProblemText) {
              // Extract only the actual problem text part, excluding hints/follow-up options, for context
              const coreProblemText = lastProblemText.split('\nOn the real test,')[0].split('\nHints:')[0].trim();
              // Avoid adding duplicate context if already present
               if (!messagesToGrok.some(m => m.role === 'system' && m.content.startsWith('Current Problem Context:'))) {
                    messagesToGrok.push({ role: "system", content: `Current Problem Context:\n${coreProblemText}` });
               }
         } else if (explanationCommands.includes(message)) {
            // If explanation requested but no problem context, inform user
             assistantResponse = "No previous problem found in this chat thread. Please generate a problem first (1-6).";
             res.write(`data: ${JSON.stringify(assistantResponse)}\n\n`);
             res.end();
             await pushMessageToConversation(user_id, "assistant", assistantResponse, problem_id);
             debug.log(`[Assistant Response for User ${user_id} Problem ${problem_id}]:\n${assistantResponse}`);
             return;
         }

         // The user message is already in messagesToGrok via the conversationHistory mapping

        debug.log(`Sending to GROK for user ${user_id}, thread ${problem_id}. Messages (last 3):`, JSON.stringify(messagesToGrok.slice(-3))); // Log last few messages

        const stream = await client.chat.completions.create({
            model: MODEL,
            messages: messagesToGrok, // Send system prompt + relevant history + context + user message
            stream: true,
        });

        let fullAssistantResponse = ""; // Accumulate the full response here
        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || "";
            if (token) {
               fullAssistantResponse += token; // Append to full response
             // Check if response is finished before writing to avoid writing after end
            if (!res.writableEnded) {
                 res.write(`data: ${JSON.stringify(token)}\n\n`); // Stream token to client
            } else {
                debug.warn(`Attempted to write to ended response stream for user ${user_id}`);
                break; // Stop processing stream if response ended
            }
            }
        }

        // --- Server-side Cleanup for Desmos Code Block (Safety Net) ---
        if (message === "9" && fullAssistantResponse.includes("### Copyable Code for Desmos:")) {
            debug.log("Attempting Desmos code block cleanup...");
            fullAssistantResponse = fullAssistantResponse.replace(
                /(### Copyable Code for Desmos:\s*\n*```plaintext\n)([\s\S]*?)(\n```)/,
                (match, prefix, codeContent, suffix) => {
                    // Remove potential leading "plaintext\n" from the actual code content
                    const cleanedCodeContent = codeContent.replace(/^plaintext\n/, '').trim();
                    debug.log("Cleaned Desmos Code Content:\n", cleanedCodeContent);
                    // Reconstruct the block, ensuring no internal "plaintext"
                    return `${prefix}${cleanedCodeContent}${suffix}`;
                }
            );
        }
        // --- End Cleanup ---


        // Append standard follow-up options for explanations AFTER the AI response is complete
         if (explanationCommands.includes(message)) {
             fullAssistantResponse += "\nHope everything was clear! If not, choose the following:\n7. Fast Time-Saving Hacks\n8. Simple Step-by-Step Explanation\n9. Desmos Explanation\n10. Simply Explain Core Concept";
         }


        if (!res.writableEnded) {
            res.end(); // End the stream properly
        }
        // Save the complete, potentially cleaned, response
        await pushMessageToConversation(user_id, "assistant", fullAssistantResponse, problem_id);
        debug.log(`[Assistant Response for User ${user_id} Problem ${problem_id}]:\n${fullAssistantResponse}`); // Log the final assembled response
    }

  } catch (err) {
    debug.error(`Error in /api/assistant for user ${user_id}:`, err.message, err.stack);
    // Send an error event only if headers haven't been sent and stream not ended
    if (!res.headersSent && !res.writableEnded) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`data: ${JSON.stringify("[ERROR]")}\n\n`);
      res.end();
    } else if (!res.writableEnded){
       // If headers sent but stream not ended, try ending it gracefully
       res.end();
    }
  }
});


// Fallback route - Unchanged
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
   // Try serving index.html first for SPA routing
   if (fs.existsSync(indexPath)) {
      debug.log(`Serving index.html for path: ${req.path}`);
      res.sendFile(indexPath);
   // Then try serving the actual file requested (e.g., math-render.js)
   } else {
      const potentialFilePath = path.join(__dirname, 'public', req.path);
      if (fs.existsSync(potentialFilePath)) {
         debug.log(`Serving static file: ${potentialFilePath}`);
         res.sendFile(potentialFilePath);
      } else {
          debug.warn(`404 Not Found for path: ${req.path}`);
          res.status(404).send("Not Found");
      }
   }
});


app.listen(PORT, () => {
  debug.log(`Server is running on port ${PORT}`);
});