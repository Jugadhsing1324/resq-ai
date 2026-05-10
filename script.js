/* ============================================================
   ResQ AI — script.js
   Gemini API integration for emergency analysis
   ============================================================ */


// ============================================================
// CONFIGURATION
// ============================================================

/**
 * STEP 1: Paste your Gemini API key below.
 * Get a free key at: https://aistudio.google.com/app/apikey
 *
 * IMPORTANT: Do NOT share this key publicly or push it to GitHub.
 * For a student project demo, pasting it here is fine — just keep
 * the project private or use environment variables in production.
 */
const GEMINI_API_KEY = "AIzaSyB_qkBRHIkJCm73QhcUmxfzdu61d9DOf-s"; // <-- Replace this


// Gemini model to use — gemini-1.5-flash is fast and free-tier friendly
const GEMINI_MODEL = "gemini-2.5-flash-lite";

// Gemini API endpoint
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ============================================================
// IMAGE STATE
// Holds the currently selected image as base64 data
// ============================================================

let selectedImageData = null;   // base64 string (without prefix)
let selectedImageMime = null;   // e.g. "image/jpeg"


// ============================================================
// SYSTEM PROMPT
// This tells Gemini exactly how to behave and what to return.
// ============================================================

const SYSTEM_PROMPT = `
You are ResQ AI — a professional emergency intelligence assistant.
A user will describe an emergency situation. They may also provide a photo of the scene — if so, use the visual context to improve your assessment.

Your job is to:
1. Identify the type of emergency (using both text and image if provided)
2. Assess the severity (Low, Moderate, High, or Critical)
3. Provide clear, numbered immediate actions to take RIGHT NOW
4. Provide additional safety advice
5. Identify which emergency service to call

You MUST respond in valid JSON format and nothing else.
Do NOT include any text outside the JSON block.
Do NOT use markdown code fences like \`\`\`json.

Return EXACTLY this JSON structure:
{
  "emergencyType": "short label like 'Kitchen Fire' or 'Cardiac Emergency'",
  "severity": "Low" or "Moderate" or "High" or "Critical",
  "immediateActions": [
    "First action to take",
    "Second action to take",
    "Third action to take",
    "Fourth action if needed"
  ],
  "safetyAdvice": [
    "Helpful safety tip one",
    "Helpful safety tip two",
    "Helpful safety tip three"
  ],
  "recommendedService": "Ambulance / Police / Fire Brigade / Multiple Services"
}
`.trim();


// ============================================================
// LOADING MESSAGES
// Shown one by one while waiting for the API response
// ============================================================

const loadingMessages = [
  "Analyzing emergency situation...",
  "Detecting hazard severity...",
  "Generating AI safety guidance...",
  "Preparing structured response..."
];


// ============================================================
// MAIN FUNCTION — Called when user clicks "Analyze Situation"
// ============================================================

async function analyzeEmergency() {

  // --- Get user input ---
  const input = document.getElementById("emergencyInput").value.trim();

  // Validate: make sure something was typed
  if (!input) {
    shakeTextarea();
    return;
  }
  if (input.length < 10) {
    alert("Please describe the situation in more detail.");
    return;
  }

  // Check if API key has been set
  if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    showError("API key not set. Please open script.js and replace YOUR_GEMINI_API_KEY_HERE with your Gemini API key.");
    return;
  }

  // --- Show loading state ---
  showLoading();

  try {
    // --- Build the request body for Gemini ---
    // Build user content parts — always include text; optionally add image
    const userParts = [];

    // If an image was attached, send it first so Gemini can visually assess the scene
    if (selectedImageData && selectedImageMime) {
      userParts.push({
        inline_data: {
          mime_type: selectedImageMime,
          data: selectedImageData
        }
      });
    }

    // Always include the text description
    userParts.push({ text: input });

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: "user",
          parts: userParts
        }
      ],
      generationConfig: {
        temperature: 0.4,    // Lower = more focused and consistent
        maxOutputTokens: 800 // Enough for the JSON response
      }
    };

    // --- Send request to Gemini API ---
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    // Handle HTTP errors (e.g. wrong API key = 400)
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData?.error?.message || `HTTP ${response.status}`);
    }

    // Parse the response JSON from Gemini
    const data = await response.json();

    // Extract the text content from Gemini's response structure
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("No response received from Gemini.");
    }

    // --- Parse the AI's JSON output ---
    const result = parseGeminiJSON(rawText);

    // --- Display the results ---
    displayResults(result);

  } catch (error) {
    console.error("ResQ AI Error:", error);
    showError(error.message || "An unexpected error occurred. Please try again.");
  }
}


// ============================================================
// PARSE GEMINI JSON
// Safely extracts and parses the JSON from Gemini's text response
// ============================================================

function parseGeminiJSON(rawText) {
  let cleanText = rawText.trim();

  // Remove markdown code fences if Gemini adds them despite instructions
  cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  // Try to find a JSON object in the text (in case of extra surrounding text)
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not find valid JSON in the AI response.");
  }

  // Parse and return the JSON object
  return JSON.parse(jsonMatch[0]);
}


// ============================================================
// IMAGE HANDLING
// handleImageSelect, removeImage — manage photo attachment
// ============================================================

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate it's an image
  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  // Enforce 5MB limit to avoid API payload issues
  if (file.size > 5 * 1024 * 1024) {
    alert("Image is too large. Please choose one under 5MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    // Store base64 data and mime type
    selectedImageMime = file.type;
    selectedImageData = dataUrl.split(",")[1]; // strip the "data:image/...;base64," prefix

    // Show preview
    document.getElementById("imgPreview").src = dataUrl;
    document.getElementById("imgPreviewWrap").style.display = "block";

    // Mark the upload button as active
    document.getElementById("imgUploadBtn").classList.add("has-image");
  };
  reader.readAsDataURL(file);

  // Reset file input so the same file can be re-selected if removed
  event.target.value = "";
}

function removeImage() {
  selectedImageData = null;
  selectedImageMime = null;
  document.getElementById("imgPreview").src = "";
  document.getElementById("imgPreviewWrap").style.display = "none";
  document.getElementById("imgUploadBtn").classList.remove("has-image");
}
// Renders the AI response into the UI cards
// ============================================================

function displayResults(data) {
  // Hide loading
  document.getElementById("loadingCard").style.display = "none";

  // Show result section
  const resultSection = document.getElementById("resultSection");
  resultSection.style.display = "flex";
  resultSection.style.flexDirection = "column";
  resultSection.style.gap = "20px";

  // Normalize severity to lowercase for CSS class matching
  const severity = (data.severity || "low").toLowerCase();

  // --- 1. Severity Meter ---
  updateSeverityMeter(severity);

  // --- 2. Emergency Type ---
  document.getElementById("emergencyType").textContent = data.emergencyType || "Unknown";

  // --- 3. Recommended Service ---
  document.getElementById("recommendedService").textContent = data.recommendedService || "—";

  // --- 4. Immediate Actions ---
  const actionsEl = document.getElementById("immediateActions");
  actionsEl.innerHTML = "";
  const actions = Array.isArray(data.immediateActions) ? data.immediateActions : [];
  actions.forEach((action, i) => {
    const li = document.createElement("li");
    li.setAttribute("data-num", i + 1);
    li.textContent = action;
    li.style.animationDelay = `${i * 0.08}s`;
    actionsEl.appendChild(li);
  });

  // --- 5. Safety Advice ---
  const adviceEl = document.getElementById("safetyAdvice");
  adviceEl.innerHTML = "";
  const advice = Array.isArray(data.safetyAdvice) ? data.safetyAdvice : [];
  advice.forEach((tip, i) => {
    const li = document.createElement("li");
    li.textContent = tip;
    li.style.animationDelay = `${i * 0.08}s`;
    adviceEl.appendChild(li);
  });

  // Smooth scroll to results
  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}


// ============================================================
// UPDATE SEVERITY METER
// Animates the meter bar and dots based on severity level
// ============================================================

function updateSeverityMeter(severity) {
  const validLevels = ["low", "moderate", "high", "critical"];
  const level = validLevels.includes(severity) ? severity : "low";

  // Update badge
  const badge = document.getElementById("severityBadge");
  badge.textContent = level.charAt(0).toUpperCase() + level.slice(1);
  badge.className = `severity-badge ${level}`;

  // Update meter fill bar
  const fill = document.getElementById("meterFill");
  fill.className = `meter-fill ${level}`;

  // Update the 4 indicator dots
  const levelIndex = { low: 1, moderate: 2, high: 3, critical: 4 };
  const activeDotCount = levelIndex[level] || 1;

  document.querySelectorAll(".meter-dots .dot").forEach((dot, i) => {
    dot.className = "dot"; // Reset
    if (i < activeDotCount) {
      dot.classList.add(`active-${level}`);
    }
  });
}


// ============================================================
// SHOW LOADING STATE
// Displays the loading card with cycling messages and progress bar
// ============================================================

function showLoading() {
  // Hide input button
  document.getElementById("analyzeBtn").disabled = true;

  // Hide any previous results or errors
  document.getElementById("resultSection").style.display = "none";
  document.getElementById("errorCard").style.display = "none";

  // Show loading card
  const loadingCard = document.getElementById("loadingCard");
  loadingCard.style.display = "block";

  // Cycle through loading messages
  let msgIndex = 0;
  const loadingText = document.getElementById("loadingText");
  const loadingFill = document.getElementById("loadingFill");

  loadingText.textContent = loadingMessages[0];
  loadingFill.style.width = "10%";

  // Update message and progress bar every 900ms
  window._loadingInterval = setInterval(() => {
    msgIndex++;
    if (msgIndex < loadingMessages.length) {
      loadingText.textContent = loadingMessages[msgIndex];
      loadingFill.style.width = `${(msgIndex + 1) * 25}%`;
    }
  }, 900);
}


// ============================================================
// SHOW ERROR
// Displays the error card with a helpful message
// ============================================================

function showError(message) {
  // Clear loading
  clearInterval(window._loadingInterval);
  document.getElementById("loadingCard").style.display = "none";
  document.getElementById("analyzeBtn").disabled = false;

  // Show error card
  const errorCard = document.getElementById("errorCard");
  document.getElementById("errorMsg").textContent = message;
  errorCard.style.display = "block";

  errorCard.scrollIntoView({ behavior: "smooth", block: "center" });
}


// ============================================================
// RESET ANALYZER
// Clears results and restores the input form
// ============================================================

function resetAnalyzer() {
  clearInterval(window._loadingInterval);

  document.getElementById("resultSection").style.display = "none";
  document.getElementById("errorCard").style.display = "none";
  document.getElementById("loadingCard").style.display = "none";
  document.getElementById("analyzeBtn").disabled = false;
  document.getElementById("emergencyInput").focus();

  // Clear image state
  removeImage();

  // Scroll back to the top of the analyzer section
  document.getElementById("analyzer").scrollIntoView({ behavior: "smooth" });
}


// ============================================================
// SHAKE ANIMATION
// Visual feedback when textarea is empty on submit
// ============================================================

function shakeTextarea() {
  const textarea = document.getElementById("emergencyInput");
  textarea.style.animation = "none";
  textarea.style.borderColor = "rgba(255,61,46,0.7)";
  textarea.style.boxShadow = "0 0 0 3px rgba(255,61,46,0.2)";

  setTimeout(() => {
    textarea.style.borderColor = "";
    textarea.style.boxShadow = "";
  }, 1200);

  textarea.focus();
}


// ============================================================
// CHARACTER COUNTER
// Updates the char count below the textarea as the user types
// ============================================================

document.getElementById("emergencyInput").addEventListener("input", function () {
  const count = this.value.length;
  const max = 1000;
  const counter = document.getElementById("charCount");

  // Enforce character limit
  if (count > max) {
    this.value = this.value.substring(0, max);
    return;
  }

  counter.textContent = `${count} / ${max} characters`;
  counter.style.color = count > 800 ? "var(--orange)" : "var(--text-dim)";
});


// ============================================================
// KEYBOARD SHORTCUT
// Ctrl+Enter or Cmd+Enter to submit
// ============================================================

document.getElementById("emergencyInput").addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    analyzeEmergency();
  }
});


// ============================================================
// NAVBAR SCROLL EFFECT
// Adds a subtle shadow when user scrolls down
// ============================================================

window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 40) {
    navbar.style.boxShadow = "0 4px 24px rgba(0,0,0,0.5)";
  } else {
    navbar.style.boxShadow = "none";
  }
});
